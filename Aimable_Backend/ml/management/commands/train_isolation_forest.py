import glob
import os
import pickle
from typing import Any

import numpy as np
import pandas as pd
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ml.models import ModelRun


class Command(BaseCommand):
    help = "Train an Isolation Forest model for claim anomaly detection using cost-based features."

    def add_arguments(self, parser) -> None:  # type: ignore[override]
        parser.add_argument(
            "--csv",
            type=str,
            help=(
                "Path to a CSV file containing medical vouchers/claims. "
                "If omitted, the latest CSV in 'media/claims' under BASE_DIR is used."
            ),
        )
        parser.add_argument(
            "--run-id",
            type=int,
            help=(
                "Optional existing ModelRun ID to attach training results to. "
                "If not provided, a new ModelRun is created."
            ),
        )
        parser.add_argument(
            "--output",
            type=str,
            default="ml_artifacts/isolation_forest.pkl",
            help=(
                "Relative path (from BASE_DIR) where the trained model artifact will be saved. "
                "Default is 'ml_artifacts/isolation_forest.pkl'."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:  # type: ignore[override]
        base_dir = getattr(settings, "BASE_DIR", os.getcwd())

        csv_path = options.get("csv")
        if not csv_path:
            csv_path = self._find_latest_claims_csv(base_dir)
            if not csv_path:
                raise CommandError(
                    "No CSV provided and no files found in 'media/claims'. "
                    "Provide --csv explicitly or add sample data."
                )

        csv_path = os.path.abspath(csv_path)
        self.stdout.write(self.style.NOTICE(f"Loading data from: {csv_path}"))

        df_raw = pd.read_csv(csv_path)
        if df_raw.empty:
            raise CommandError("CSV file is empty; cannot train model.")

        df = self._prepare_dataframe(df_raw)
        feature_cols = [
            "consultation_cost",
            "laboratory_cost",
            "imaging_cost",
            "procedures_cost",
            "medicines_cost",
            "total_amount",
            "lab_ratio",
            "imaging_ratio",
            "consultation_ratio",
            "total_diff",
        ]

        missing = [c for c in feature_cols if c not in df.columns]
        if missing:
            raise CommandError(f"Missing expected feature columns: {missing}")

        X = df[feature_cols].astype(float).values

        # Compute simple z-score normalisation per feature as per Chapter 4.
        means = X.mean(axis=0)
        stds = X.std(axis=0)
        stds[stds == 0] = 1.0
        X_norm = (X - means) / stds

        try:
            from sklearn.ensemble import IsolationForest
        except ImportError as exc:  # pragma: no cover - runtime dependency
            raise CommandError(
                "scikit-learn is required to run this command. "
                "Install it with 'pip install scikit-learn'."
            ) from exc

        self.stdout.write(self.style.NOTICE("Training Isolation Forest model..."))
        model = IsolationForest(
            n_estimators=100,
            contamination="auto",
            random_state=42,
        )
        model.fit(X_norm)

        scores = model.decision_function(X_norm)
        labels = model.predict(X_norm)  # 1 = normal, -1 = anomaly
        n_samples = X.shape[0]
        n_anomalies = int((labels == -1).sum())
        frac_anomalies = float(n_anomalies) / float(n_samples)

        self.stdout.write(
            self.style.SUCCESS(
                f"Model trained on {n_samples} samples; anomalies detected: "
                f"{n_anomalies} ({frac_anomalies:.2%})."
            )
        )

        # Ensure output directory exists and write the model artifact.
        rel_output = options.get("output") or "ml_artifacts/isolation_forest.pkl"
        abs_output = os.path.join(base_dir, rel_output)
        os.makedirs(os.path.dirname(abs_output), exist_ok=True)
        with open(abs_output, "wb") as f:
            pickle.dump({"model": model, "means": means, "stds": stds, "feature_cols": feature_cols}, f)

        self.stdout.write(self.style.SUCCESS(f"Model artifact saved to: {abs_output}"))

        # Attach results to an existing or new ModelRun.
        run_id = options.get("run_id")
        if run_id:
            try:
                model_run = ModelRun.objects.get(pk=run_id)
                created = False
            except ModelRun.DoesNotExist as exc:
                raise CommandError(f"ModelRun with id={run_id} does not exist.") from exc
        else:
            model_run = ModelRun.objects.create(
                name="Isolation Forest (auto)",
                status="testing",
            )
            created = True

        params = model_run.parameters or {}
        params.setdefault("algorithm", "IsolationForest")
        params.setdefault("artifact_path", rel_output)
        params.setdefault("source_csv", os.path.relpath(csv_path, base_dir))

        metrics = model_run.metrics or {}
        metrics.update(
            {
                "n_samples": int(n_samples),
                "n_anomalies": int(n_anomalies),
                "fraction_anomalies": float(frac_anomalies),
            }
        )

        model_run.parameters = params
        model_run.metrics = metrics
        model_run.save(update_fields=["parameters", "metrics", "updated_at"])

        action = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} ModelRun id={model_run.id} with artifact_path='{rel_output}'."
            )
        )

    def _find_latest_claims_csv(self, base_dir: str) -> str | None:
        pattern = os.path.join(base_dir, "media", "claims", "*.csv")
        files = glob.glob(pattern)
        if not files:
            return None
        return max(files, key=os.path.getmtime)

    def _prepare_dataframe(self, df_raw: pd.DataFrame) -> pd.DataFrame:
        """Normalise column names and derive Chapter 4 cost features.

        The sample vouchers file uses columns such as:
        - 'Consultation Cost'
        - 'Laboratory Cost'
        - 'Medical Imaging Cost'
        - 'Procedures'
        - 'Medicines'
        - 'Total Amount'
        """

        df = df_raw.copy()
        # Standardise column names to snake_case for easier processing.
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        def _to_float(series: pd.Series) -> pd.Series:
            return pd.to_numeric(series, errors="coerce").fillna(0.0)

        consultation = _to_float(df.get("consultation_cost", 0.0))
        laboratory = _to_float(df.get("laboratory_cost", 0.0))
        imaging = _to_float(df.get("medical_imaging_cost", 0.0))
        procedures = _to_float(df.get("procedures", 0.0))
        medicines = _to_float(df.get("medicines", 0.0))
        total = _to_float(df.get("total_amount", 0.0))

        components_sum = consultation + laboratory + imaging + procedures + medicines
        total_safe = total.replace(0, np.nan)

        lab_ratio = laboratory / total_safe
        imaging_ratio = imaging / total_safe
        consultation_ratio = consultation / total_safe

        lab_ratio = lab_ratio.fillna(0.0)
        imaging_ratio = imaging_ratio.fillna(0.0)
        consultation_ratio = consultation_ratio.fillna(0.0)

        total_diff = total - components_sum

        out = pd.DataFrame(
            {
                "consultation_cost": consultation,
                "laboratory_cost": laboratory,
                "imaging_cost": imaging,
                "procedures_cost": procedures,
                "medicines_cost": medicines,
                "total_amount": total,
                "lab_ratio": lab_ratio,
                "imaging_ratio": imaging_ratio,
                "consultation_ratio": consultation_ratio,
                "total_diff": total_diff,
            }
        )

        return out
