from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.shortcuts import get_object_or_404
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from api.models import Claim, SystemLog

from .models import ModelRun
from .serializers import ModelRunSerializer

from decimal import Decimal
import os
import pickle
from typing import Any, Tuple, Dict

import numpy as np


class ModelRunListCreateView(views.APIView):
    """Create a new model run or list historical runs.

    This endpoint is used by the Data Scientist dashboard to:
    - List historical training/experiment runs
    - Start a new model training run with configuration parameters
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        queryset = ModelRun.objects.all()
        serializer = ModelRunSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        # The frontend sends a high-level configuration payload.
        # We persist it in "parameters" and initialise a "training" status.
        payload = request.data.copy()
        name = payload.get("name") or payload.get("modelName") or "Model Run"

        model_run = ModelRun.objects.create(
            name=name,
            status=payload.get("status") or "training",
            parameters=payload.get("parameters") or payload,
            metrics=payload.get("metrics") or {},
        )

        # Trigger model training immediately using the management command so
        # that the resulting artifact and metrics are attached to this run.
        csv_path = None
        params = model_run.parameters or {}
        if isinstance(params, dict):
            csv_path = params.get("csv") or params.get("csvPath")

        try:
            if csv_path:
                call_command("train_isolation_forest", run_id=model_run.id, csv=csv_path)
            else:
                call_command("train_isolation_forest", run_id=model_run.id)
        except CommandError as exc:
            # Mark the run as failed and return a clear error to the client.
            model_run.status = "failed"
            model_run.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": f"Model training failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Reload the run to include any parameters/metrics updates from training.
        model_run.refresh_from_db()
        serializer = ModelRunSerializer(model_run)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ModelRunDetailView(views.APIView):
    """Retrieve or update a single model run.

    Used by the Data Scientist to:
    - Promote a model from training/testing to deployed
    - Update run metadata such as name, status, parameters, or metrics
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk: int) -> ModelRun:
        return get_object_or_404(ModelRun, pk=pk)

    def get(self, request, pk: int, *args, **kwargs):
        model_run = self.get_object(pk)
        serializer = ModelRunSerializer(model_run)
        return Response(serializer.data)

    def patch(self, request, pk: int, *args, **kwargs):
        model_run = self.get_object(pk)
        data = request.data or {}

        # Allow updating core fields; ignore unknowns.
        new_status = data.get("status")
        if new_status == "deployed":
            # Ensure only one model is deployed at any time.
            if ModelRun.objects.exclude(pk=model_run.pk).filter(status="deployed").exists():
                return Response(
                    {"detail": "Another model is already deployed. Please undeploy it before deploying a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if "name" in data:
            model_run.name = data["name"] or model_run.name
        if "status" in data:
            model_run.status = new_status or model_run.status
        if "parameters" in data and isinstance(data["parameters"], dict):
            model_run.parameters = data["parameters"]
        if "metrics" in data and isinstance(data["metrics"], dict):
            model_run.metrics = data["metrics"]

        model_run.save()
        serializer = ModelRunSerializer(model_run)
        return Response(serializer.data)

    def delete(self, request, pk: int, *args, **kwargs):
        model_run = self.get_object(pk)
        model_run.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class _NoDeployedModel(RuntimeError):
    pass


class _MissingArtifactPath(RuntimeError):
    pass


_DEPLOYED_MODEL_CACHE: dict[str, Any] = {"run_id": None, "model": None}


def _resolve_artifact_path(artifact_path: str) -> str:
    """Resolve a potentially relative artifact path to an absolute path.

    The path is interpreted as relative to Django's BASE_DIR when not
    already absolute, so a Data Scientist can store e.g. "ml_artifacts/model.pkl"
    in ModelRun.parameters["artifact_path"].
    """

    if os.path.isabs(artifact_path):
        return artifact_path
    base_dir = getattr(settings, "BASE_DIR", None)
    if base_dir:
        return os.path.join(str(base_dir), artifact_path)
    return os.path.abspath(artifact_path)


def _get_deployed_model() -> Tuple[Any, ModelRun]:
    """Return the currently deployed model instance and its ModelRun.

    The associated ModelRun should have status="deployed" and its
    parameters JSON is expected to contain an "artifact_path" (or
    "artifactPath") pointing to a pickled model file.
    """

    model_run = ModelRun.objects.filter(status="deployed").order_by("-created_at").first()
    if not model_run:
        raise _NoDeployedModel("No ModelRun with status 'deployed' found.")

    params = model_run.parameters or {}
    artifact_path = (
        params.get("artifact_path")
        or params.get("artifactPath")
        or params.get("model_path")
    )
    if not artifact_path:
        raise _MissingArtifactPath(
            "Deployed ModelRun.parameters must contain an 'artifact_path' (or 'artifactPath'/'model_path').",
        )

    if _DEPLOYED_MODEL_CACHE["run_id"] == model_run.id and _DEPLOYED_MODEL_CACHE["model"] is not None:
        return _DEPLOYED_MODEL_CACHE["model"], model_run

    abs_path = _resolve_artifact_path(str(artifact_path))
    with open(abs_path, "rb") as f:
        artifact_obj = pickle.load(f)

    _DEPLOYED_MODEL_CACHE["run_id"] = model_run.id
    _DEPLOYED_MODEL_CACHE["model"] = artifact_obj
    return artifact_obj, model_run


class PredictClaimRiskView(views.APIView):
    """Score a claim's fraud risk using the currently deployed model.

    Expects a JSON body like {"claimId": 123}. The view will:
    - Load the currently deployed ModelRun's artifact (pickled model)
    - Build a basic feature vector from the Claim
    - Call the model to obtain a score
    - Store the score in Claim.risk_score (0-100) and flag high-risk claims
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    HIGH_RISK_THRESHOLD = Decimal("70.00")

    def post(self, request, *args, **kwargs):  # type: ignore[override]
        payload = request.data or {}
        claim_id = payload.get("claimId")
        if claim_id is None:
            return Response(
                {"detail": "'claimId' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            claim_id_int = int(claim_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "'claimId' must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        claim = get_object_or_404(Claim, pk=claim_id_int)

        try:
            artifact_obj, model_run = _get_deployed_model()
        except _NoDeployedModel:
            return Response(
                {"detail": "No deployed model is available. Please deploy a model first."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except _MissingArtifactPath as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except FileNotFoundError:
            return Response(
                {"detail": "The deployed model's artifact file could not be found on the server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception:
            return Response(
                {"detail": "Failed to load the deployed model artifact."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Extract model and optional normalisation parameters from the artifact.
        if isinstance(artifact_obj, dict) and "model" in artifact_obj:
            model_obj = artifact_obj["model"]
            feature_cols = artifact_obj.get("feature_cols")
            means = np.array(artifact_obj.get("means")) if artifact_obj.get("means") is not None else None
            stds = np.array(artifact_obj.get("stds")) if artifact_obj.get("stds") is not None else None
        else:
            model_obj = artifact_obj
            feature_cols = None
            means = None
            stds = None

        feature_map = self._build_features(claim)

        # Build feature vector in the same order as during training.
        if feature_cols is not None:
            try:
                x = np.array([[float(feature_map[name]) for name in feature_cols]], dtype=float)
            except KeyError as exc:
                return Response(
                    {"detail": f"Feature '{exc.args[0]}' expected by the deployed model is missing from Claim."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        else:
            # Fallback: rely on map iteration order if model doesn't specify.
            x = np.array([[float(v) for v in feature_map.values()]], dtype=float)

        if means is not None and stds is not None:
            stds_safe = np.where(stds == 0.0, 1.0, stds)
            x_norm = (x - means) / stds_safe
        else:
            x_norm = x

        try:
            # Prefer probabilistic output if available.
            if hasattr(model_obj, "predict_proba"):
                proba = float(model_obj.predict_proba(x_norm)[0][1])
                raw_score = proba * 100.0
            else:
                pred = float(model_obj.predict(x_norm)[0])
                # If the output looks like a probability, convert to 0-100.
                if 0.0 <= pred <= 1.0:
                    raw_score = pred * 100.0
                else:
                    raw_score = pred
        except Exception:
            return Response(
                {"detail": "Error while running prediction with the deployed model."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Clamp to [0, 100] and store as Decimal with 2 decimal places.
        bounded = max(0.0, min(100.0, raw_score))
        score_decimal = Decimal(f"{bounded:.2f}")

        # Apply simple rule-based checks on top of the ML score for
        # interpretability (Chapter 4 rule-based fraud detection).
        rule_flags = self._apply_rules(feature_map)

        claim.risk_score = score_decimal
        if score_decimal >= self.HIGH_RISK_THRESHOLD or rule_flags["hasRuleHit"]:
            claim.is_flagged = True
        claim.save(update_fields=["risk_score", "is_flagged", "updated_at"])

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            source="ML Model",
            message=f"Risk score updated for claim {claim.claim_number}",
            details=(
                f"ModelRun={model_run.id} | Score={score_decimal} | "
                f"RuleHits={','.join(rule_flags['triggeredRules']) or 'none'}"
            ),
            user=request.user if request.user.is_authenticated else None,
        )

        return Response(
            {
                "claimId": claim.id,
                "riskScore": float(score_decimal),
                "isFlagged": claim.is_flagged,
                "modelRunId": model_run.id,
                "modelRunName": model_run.name,
                "rules": rule_flags,
            },
            status=status.HTTP_200_OK,
        )

    def _build_features(self, claim: Claim) -> Dict[str, float]:
        """Construct cost-based features from a Claim.

        Matches the feature engineering used during training in the
        `train_isolation_forest` management command, including:
        - raw cost components
        - cost ratios relative to total amount
        - consistency check (difference between total and components sum)
        """

        total_amount = float(claim.amount or 0)
        consultation = float(claim.consultation_cost or 0)
        laboratory = float(claim.laboratory_cost or 0)
        imaging = float(claim.imaging_cost or 0)
        procedures = float(claim.procedures_cost or 0)
        medicines = float(claim.medicines_cost or 0)

        components_sum = consultation + laboratory + imaging + procedures + medicines

        if total_amount > 0:
            lab_ratio = laboratory / total_amount
            imaging_ratio = imaging / total_amount
            consultation_ratio = consultation / total_amount
        else:
            lab_ratio = 0.0
            imaging_ratio = 0.0
            consultation_ratio = 0.0

        total_diff = total_amount - components_sum

        return {
            "consultation_cost": consultation,
            "laboratory_cost": laboratory,
            "imaging_cost": imaging,
            "procedures_cost": procedures,
            "medicines_cost": medicines,
            "total_amount": total_amount,
            "lab_ratio": lab_ratio,
            "imaging_ratio": imaging_ratio,
            "consultation_ratio": consultation_ratio,
            "total_diff": total_diff,
        }

    def _apply_rules(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Apply simple, interpretable rules on top of the ML score.

        Rules reflect the examples in Chapter 4:
        - Laboratory cost exceeding ~70% of total cost
        - Significant mismatch between reported total and sum of components
        - Very high total amount compared to typical claims (simple threshold)
        """

        triggered: list[str] = []
        lab_ratio = float(features.get("lab_ratio", 0.0))
        total_diff = float(features.get("total_diff", 0.0))
        total_amount = float(features.get("total_amount", 0.0))

        # Rule 1: laboratory cost exceeds 70% of the total amount.
        if lab_ratio > 0.7:
            triggered.append("high_lab_ratio")

        # Rule 2: large mismatch between total and sum of components.
        if abs(total_diff) > max(0.1 * total_amount, 5000.0):
            triggered.append("inconsistent_total_vs_components")

        # Rule 3: extremely high total claim amount (absolute threshold).
        if total_amount > 500000.0:
            triggered.append("very_high_total_amount")

        return {
            "hasRuleHit": bool(triggered),
            "triggeredRules": triggered,
        }
