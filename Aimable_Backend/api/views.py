from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta, datetime
from rest_framework import permissions, viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

import csv
from decimal import Decimal
from io import TextIOWrapper
import pandas as pd
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename

from .models import Claim, UserProfile, SystemLog
from .serializers import ClaimSerializer, AdminUserSerializer, SystemLogSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
	"""Simple endpoint to verify the backend is running."""
	return Response({"status": "ok", "service": "aimable-backend"})


@api_view(["GET"])
@permission_classes([AllowAny])
def dashboard_summary(request):
	"""Summary payload for the admin system dashboard.

	Aggregates information from users, claims and system logs so the
	frontend can render cards, recent activities, and simple metrics.
	"""
	from datetime import timedelta

	now = timezone.now()
	last_24h = now - timedelta(hours=24)

	total_users = User.objects.count()
	active_users = User.objects.filter(is_active=True).count()
	total_claims = Claim.objects.count()
	flagged_claims = Claim.objects.filter(is_flagged=True).count()
	fraud_cases = Claim.objects.filter(is_fraud=True).count()

	error_logs_24h = SystemLog.objects.filter(
		level=SystemLog.Level.ERROR, timestamp__gte=last_24h
	).count()
	warning_logs_24h = SystemLog.objects.filter(
		level=SystemLog.Level.WARNING, timestamp__gte=last_24h
	).count()

	# Simple health score: start at 100 and subtract a small amount based
	# on recent warnings/errors, clamped to a sensible minimum.
	penalty = error_logs_24h * 5 + warning_logs_24h * 2
	system_health = max(60.0, 100.0 - float(penalty))

	pending_alerts = flagged_claims + error_logs_24h + warning_logs_24h

	recent_logs = (
		SystemLog.objects.select_related("user")
		.order_by("-timestamp")[:5]
	)
	recent_activities = []
	for log in recent_logs:
		user = log.user
		user_label = "System"
		if user:
			user_label = user.get_full_name() or user.email or user.username or "User"
		recent_activities.append(
			{
				"id": log.id,
				"message": log.message,
				"user": user_label,
				"source": log.source,
				"level": log.level,
				"timestamp": log.timestamp.isoformat(),
			}
		)

	# Try to derive simple live performance metrics from the host where
	# Django is running. If psutil isn't available, fall back to the
	# previous static example values so the endpoint still works.
	cpu_usage = 45
	memory_usage = 62
	database_usage = 38
	disk_usage = 71

	try:  # pragma: no cover - optional system metrics
		import psutil  # type: ignore[import-not-found]

		cpu_usage = int(psutil.cpu_percent(interval=0.1))
		memory_usage = int(psutil.virtual_memory().percent)
		disk = psutil.disk_usage("/")
		disk_usage = int(disk.percent)
		# Approximate "database" usage as a fraction of disk usage so the
		# value moves with real utilisation but stays in a readable range.
		database_usage = max(0, min(100, disk_usage - 20))
	except Exception:
		# Silently keep the default example numbers if anything goes wrong.
		pass

	from ml.models import ModelRun
	ml_models_total = ModelRun.objects.count()
	ml_models_production = ModelRun.objects.filter(status="deployed").count()

	data = {
		"totalUsers": total_users,
		"activeUsers": active_users,
		"systemHealth": round(system_health, 1),
		"pendingAlerts": pending_alerts,
		"totalClaims": total_claims,
		"flaggedClaims": flagged_claims,
		"fraudCases": fraud_cases,
		"mlModelsTotal": ml_models_total,
		"mlModelsProduction": ml_models_production,
		"recentActivities": recent_activities,
		"performance": {
			"cpu": cpu_usage,
			"memory": memory_usage,
			"database": database_usage,
			"disk": disk_usage,
		},
	}
	return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
	"""Return basic information about the currently authenticated user.

	This is used by the frontend after login to determine the user's
	application role (admin, analyst, scientist, facility) and name so
	that it can redirect to the correct dashboard.
	"""
	user = request.user
	# Determine application role, with safe handling when no profile exists.
	if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
		# Treat Django admin/staff accounts as system administrators.
		role = UserProfile.Role.ADMIN
	else:
		try:
			profile = user.profile  # type: ignore[attr-defined]
			role = profile.role
		except UserProfile.DoesNotExist:  # type: ignore[attr-defined]
			# Fallback role when no profile has been created yet.
			role = UserProfile.Role.ANALYST

	full_name = user.get_full_name() or user.username or user.email
	return Response(
		{
			"id": user.id,
			"name": full_name,
			"username": user.username,
			"email": user.email,
			"role": role,
		}
	)


class ClaimViewSet(viewsets.ModelViewSet):
	queryset = Claim.objects.all().order_by("-created_at")
	serializer_class = ClaimSerializer
	permission_classes = [IsAuthenticated]

	@action(detail=False, methods=["post"], url_path="bulk-delete")
	def bulk_delete(self, request):
		"""Delete one or more claims by ID.

		Expects a JSON body {"ids": [1, 2, 3]} of claim primary keys.
		Fraud Analysts can use this to clean up imported or test claims.
		"""

		ids = request.data.get("ids", [])
		if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
			return Response(
				{"detail": "Invalid payload. Expected 'ids' as a list of integers."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		to_delete = list(Claim.objects.filter(id__in=ids))
		if not to_delete:
			return Response({"detail": "No matching claims found.", "deleted": 0})

		claim_numbers = [c.claim_number for c in to_delete]
		count = len(to_delete)
		Claim.objects.filter(id__in=ids).delete()

		SystemLog.objects.create(
			level=SystemLog.Level.WARNING,
			source="Fraud Analyst",
			message=f"Bulk deleted {count} claim(s)",
			details="Claims: " + ", ".join(claim_numbers),
			user=request.user if request.user.is_authenticated else None,
		)

		return Response({"detail": "Claims deleted.", "deleted": count})

	@action(detail=False, methods=["post"], url_path="upload")
	def upload_claims(self, request):
		"""Ingest a CSV/XLSX export of claims and create Claim rows.

		For now we support CSV uploads where each row contains at least:
		- voucher or claim_number
		- policy_holder / beneficiary
		- total_amount

		Risk score is initialised to 0; ML scoring can update it later.
		"""

		uploaded_file = request.FILES.get("file")
		if not uploaded_file:
			return Response(
				{"detail": "No file provided. Please upload a CSV file."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		# Save original file to disk for auditing/reproducibility
		timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
		original_name = get_valid_filename(uploaded_file.name)
		stored_relative_path = f"claims/{timestamp}_{original_name}"
		stored_path = default_storage.save(stored_relative_path, uploaded_file)
		# Ensure file pointer is reset before parsing
		uploaded_file.seek(0)

		filename = uploaded_file.name.lower()
		rows = []

		# Support both CSV and Excel (xlsx/xls) uploads
		if filename.endswith(".csv"):
			try:
				text_file = TextIOWrapper(uploaded_file.file, encoding="utf-8")
				reader = csv.DictReader(text_file)
			except Exception:
				return Response(
					{"detail": "Could not read CSV file. Please check the format."},
					status=status.HTTP_400_BAD_REQUEST,
				)
			for row in reader:
				rows.append(row)
		elif filename.endswith(".xlsx") or filename.endswith(".xls"):
			# First, try to handle the structured voucher export layout used in the
			# provided sample (metadata rows, then a header row containing
			# "VOUCHER IDENTIFICATION" and "TOTAL AMOUNT"). If that pattern is not
			# found, fall back to the generic header-based parsing.
			try:
				df_raw = pd.read_excel(uploaded_file, header=None)
			except Exception:
				return Response(
					{"detail": "Could not read Excel file. Please check the format."},
					status=status.HTTP_400_BAD_REQUEST,
				)

			from math import isnan as _isnan  # simple NaN check helper for numeric cells

			# Extract header metadata: health facility, facility code, and month from
			# the first column where rows look like "HEALTH FACILITY: ..." etc.
			health_facility = None
			facility_code = None
			month_label = None
			for _, meta_row in df_raw.iloc[:10].iterrows():
				val = meta_row.iloc[0]
				if not isinstance(val, str):
					continue
				upper = val.upper()
				if "HEALTH FACILITY:" in upper and health_facility is None:
					parts = val.split(":", 1)
					if len(parts) == 2:
						health_facility = parts[1].strip()
				elif "CODE / HEALTH CACILITY:" in upper and facility_code is None:
					parts = val.split(":", 1)
					if len(parts) == 2:
						facility_code = parts[1].strip()
				elif "MONTH:" in upper and month_label is None:
					parts = val.split(":", 1)
					if len(parts) == 2:
						month_label = parts[1].strip()

			header_idx = None
			for idx, row in df_raw.iterrows():
				for cell in row.values:
					if isinstance(cell, str) and "VOUCHER IDENTIFICATION" in cell.upper():
						header_idx = idx
						break
				if header_idx is not None:
					break

			if header_idx is not None:
				# Structured voucher export: infer column positions for voucher,
				# beneficiary, DATE, and TOTAL AMOUNT from the header row.
				header_row = df_raw.iloc[header_idx]
				col_voucher = None
				col_beneficiary = None
				col_amount = None
				col_date = None
				for idx, cell in enumerate(header_row.values):
					if not isinstance(cell, str):
						continue
					upper = cell.upper()
					if "VOUCHER IDENTIFICATION" in upper and col_voucher is None:
						col_voucher = idx
					if "BENEFICIARY" in upper and col_beneficiary is None:
						col_beneficiary = idx
					if "TOTAL AMOUNT" in upper and col_amount is None:
						col_amount = idx
					if "DATE" in upper and col_date is None:
						col_date = idx

				for _, row in df_raw.iloc[header_idx + 1 :].iterrows():
					voucher = row.iloc[col_voucher] if col_voucher is not None and len(row) > col_voucher else None
					beneficiary = (
						row.iloc[col_beneficiary]
						if col_beneficiary is not None and len(row) > col_beneficiary
						else None
					)
					amount_cell = (
						row.iloc[col_amount]
						if col_amount is not None and len(row) > col_amount
						else None
					)
					date_cell = (
						row.iloc[col_date]
						if col_date is not None and len(row) > col_date
						else None
					)

					# Skip rows that do not look like actual vouchers (empty or NaN).
					def _empty(val):
						if val is None:
							return True
						if isinstance(val, float):
							try:
								return _isnan(val)
							except Exception:  # pragma: no cover - defensive
								return False
						return str(val).strip() == ""

					if _empty(voucher) or _empty(beneficiary) or _empty(amount_cell):
						continue

					row_dict = {
						"voucher": str(voucher).strip(),
						"beneficiary": str(beneficiary).strip(),
						"total_amount": str(amount_cell).strip(),
					}
					if not _empty(date_cell):
						row_dict["date"] = date_cell
					rows.append(row_dict)
			else:
				# Fallback: treat the first non-metadata row as a header row and use
				# the generic column-name based normalisation logic below.
				try:
					df = pd.read_excel(uploaded_file)
				except Exception:
					return Response(
						{"detail": "Could not read Excel file. Please check the format."},
						status=status.HTTP_400_BAD_REQUEST,
					)
				rows = df.to_dict(orient="records")
		else:
			return Response(
				{"detail": "Unsupported file type. Please upload CSV or Excel (.xlsx/.xls) files."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		created_count = 0
		created_ids: list[int] = []
		for row in rows:
			# Normalise column names to be case-insensitive and ignore spaces
			normalized = {}
			for key, value in row.items():
				if key is None:
					continue
				col = str(key).strip().lower().replace(" ", "_")
				normalized[col] = value if value is not None else ""

			claim_number = (
				normalized.get("voucher")
				or normalized.get("voucher_id")
				or normalized.get("claim_number")
				or ""
			)
			policy_holder = (
				normalized.get("beneficiary")
				or normalized.get("beneficiary_number")
				or normalized.get("policy_holder")
				or ""
			)
			amount_str = (
				str(
					normalized.get("total_amount")
					or normalized.get("total_amount_rwf")
					or normalized.get("amount")
					or normalized.get("total")
					or "0",
				)
			)

			# Optional cost component fields used for ML cost-based features.
			consultation_str = (
				str(
					normalized.get("consultation_cost")
					or normalized.get("consultation")
					or "0",
				)
			)
			laboratory_str = (
				str(
					normalized.get("laboratory_cost")
					or normalized.get("lab_cost")
					or normalized.get("laboratory")
					or "0",
				)
			)
			imaging_str = (
				str(
					normalized.get("medical_imaging_cost")
					or normalized.get("imaging_cost")
					or normalized.get("imaging")
					or "0",
				)
			)
			procedures_str = (
				str(
					normalized.get("procedures_cost")
					or normalized.get("procedures_and_materials")
					or normalized.get("procedures")
					or "0",
				)
			)
			medicines_str = (
				str(
					normalized.get("medicines_cost")
					or normalized.get("consumables_cost")
					or normalized.get("medicines")
					or "0",
				)
			)

			# DATE column from the file, used to detect duplicates on the same day
			# or within a one-week period.
			raw_date = (
				normalized.get("date")
				or normalized.get("service_date")
				or normalized.get("claim_date")
			)
			service_date = None
			if raw_date:
				# Handle pandas Timestamp / datetime / date values directly.
				from datetime import date as _date_type

				if hasattr(raw_date, "to_pydatetime"):
					raw_date = raw_date.to_pydatetime()
				if isinstance(raw_date, datetime):
					service_date = raw_date.date()
				elif isinstance(raw_date, _date_type):
					service_date = raw_date
				else:
					# Try a few common string formats; if all fail, leave as None.
					text = str(raw_date).strip()
					for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
						try:
							service_date = datetime.strptime(text, fmt).date()
							break
						except Exception:
							continue

			if not claim_number or not policy_holder:
				continue

			try:
				amount = Decimal(amount_str or "0")
			except Exception:
				amount = Decimal("0")

			def _parse_decimal(value: str) -> Decimal:
				try:
					return Decimal(value or "0")
				except Exception:
					return Decimal("0")

			consultation_cost = _parse_decimal(consultation_str)
			laboratory_cost = _parse_decimal(laboratory_str)
			imaging_cost = _parse_decimal(imaging_str)
			procedures_cost = _parse_decimal(procedures_str)
			medicines_cost = _parse_decimal(medicines_str)

			claim, created = Claim.objects.get_or_create(
				claim_number=claim_number,
				defaults={
					"policy_holder": policy_holder,
					"amount": amount,
					"consultation_cost": consultation_cost,
					"laboratory_cost": laboratory_cost,
					"imaging_cost": imaging_cost,
					"procedures_cost": procedures_cost,
					"medicines_cost": medicines_cost,
					"service_date": service_date,
					"is_flagged": False,
					"is_fraud": False,
					"risk_score": Decimal("0"),
					"review_status": Claim.ReviewStatus.PENDING,
				},
			)
			if created:
				created_count += 1
				created_ids.append(claim.id)

			is_suspicious = False
			if not created:
				# Duplicate voucher/claim_number encountered again in an upload.
				is_suspicious = True

			# Use the DATE from the file when available; otherwise fall back to
			# the claim's stored service_date, and finally to created_at.date().
			if service_date or getattr(claim, "service_date", None):
				ref_date = service_date or claim.service_date
				window_start = ref_date - timedelta(days=7)
				recent_same_beneficiary = Claim.objects.filter(
					policy_holder=claim.policy_holder,
					service_date__gte=window_start,
					service_date__lte=ref_date,
				)
			else:
				ref_date = claim.created_at.date()
				window_start = ref_date - timedelta(days=7)
				recent_same_beneficiary = Claim.objects.filter(
					policy_holder=claim.policy_holder,
					created_at__date__gte=window_start,
					created_at__date__lte=ref_date,
				)

			if recent_same_beneficiary.count() > 1:
				is_suspicious = True
				# Flag all claims in this window for the same beneficiary.
				recent_same_beneficiary.update(is_flagged=True)

			if is_suspicious and not claim.is_flagged:
				claim.is_flagged = True
				claim.save(update_fields=["is_flagged", "updated_at"])

		SystemLog.objects.create(
			level=SystemLog.Level.INFO,
			source="Claims Upload",
			message=f"Claims file '{uploaded_file.name}' processed",
			details=f"Stored at '{stored_path}'. Created {created_count} new claims.",
			user=request.user if request.user.is_authenticated else None,
		)

		meta = None
		try:
			# Only Excel uploads currently provide structured header metadata.
			if filename.endswith(".xlsx") or filename.endswith(".xls"):
				meta = {
					"healthFacility": health_facility,
					"facilityCode": facility_code,
					"month": month_label,
				}
		except Exception:
			meta = None

		return Response(
			{
				"detail": "Claims file processed.",
				"created": created_count,
				"createdIds": created_ids,
				"meta": meta,
			},
			status=status.HTTP_201_CREATED,
		)

	@action(detail=True, methods=["post"], url_path="add-note")
	def add_note(self, request, pk=None):
		"""Append an investigation note to a claim.

		Fraud Analysts use this to document their findings; notes are appended
		to the claim's `notes` field as separate lines for now.
		"""

		claim = self.get_object()
		text = (request.data.get("note") or "").strip()
		if not text:
			return Response({"detail": "Note cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

		prefix = claim.notes + "\n" if claim.notes else ""
		claim.notes = prefix + text
		claim.save(update_fields=["notes", "updated_at"])

		SystemLog.objects.create(
			level=SystemLog.Level.INFO,
			source="Fraud Analyst",
			message=f"Investigation note added to claim {claim.claim_number}",
			details=text,
			user=request.user if request.user.is_authenticated else None,
		)

		serializer = self.get_serializer(claim)
		return Response(serializer.data)

	@action(detail=True, methods=["post"], url_path="set-review-status")
	def set_review_status(self, request, pk=None):
		"""Update the analyst review status (pending/investigation/fraudulent/legitimate).

		When marked fraudulent, `is_fraud` is set and the claim remains flagged.
		When marked legitimate, the claim is unflagged and `is_fraud` is cleared.
		"""

		claim = self.get_object()
		status_value = request.data.get("status")
		reason = (request.data.get("reason") or "").strip()

		valid_statuses = {choice[0] for choice in Claim.ReviewStatus.choices}
		if status_value not in valid_statuses:
			return Response(
				{"detail": "Invalid review status."}, status=status.HTTP_400_BAD_REQUEST
			)

		claim.review_status = status_value
		if status_value == Claim.ReviewStatus.FRAUDULENT:
			claim.is_fraud = True
			claim.is_flagged = True
		elif status_value == Claim.ReviewStatus.LEGITIMATE:
			claim.is_fraud = False
			claim.is_flagged = False

		claim.save()

		SystemLog.objects.create(
			level=SystemLog.Level.WARNING if claim.is_fraud else SystemLog.Level.INFO,
			source="Fraud Analyst",
			message=f"Claim {claim.claim_number} review status set to {status_value}",
			details=reason,
			user=request.user if request.user.is_authenticated else None,
		)

		serializer = self.get_serializer(claim)
		return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
	"""Logout by blacklisting the provided refresh token.

	The frontend should send {"refresh": "<refresh_token>"} in the body.
	Even if blacklisting fails, the client should still clear its tokens.
	"""
	refresh_token = request.data.get("refresh")
	if not refresh_token:
		return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

	try:
		token = RefreshToken(refresh_token)
		token.blacklist()
	except TokenError:
		return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

	return Response({"detail": "Logged out successfully."}, status=status.HTTP_205_RESET_CONTENT)


class IsAdminRole(permissions.BasePermission):
	"""Allow access only to users with the admin application role."""

	def has_permission(self, request, view) -> bool:  # type: ignore[override]
		user = request.user
		if not user or not user.is_authenticated:
			return False
		if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
			return True
		profile = getattr(user, "profile", None)
		return bool(profile and profile.role == UserProfile.Role.ADMIN)


class SystemLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
	"""Read-only viewset exposing system logs for admins."""

	queryset = SystemLog.objects.all().order_by("-timestamp")
	serializer_class = SystemLogSerializer
	permission_classes = [IsAuthenticated, IsAdminRole]


class AdminUserViewSet(
	mixins.ListModelMixin,
	mixins.CreateModelMixin,
	mixins.RetrieveModelMixin,
	mixins.UpdateModelMixin,
	mixins.DestroyModelMixin,
	viewsets.GenericViewSet,
):
	"""ViewSet for system admin user management operations."""

	queryset = User.objects.all().order_by("-date_joined")
	serializer_class = AdminUserSerializer
	permission_classes = [IsAuthenticated, IsAdminRole]

	def _log(self, request, level: str, message: str, details: str = "") -> None:
		SystemLog.objects.create(
			level=level,
			source="User Management",
			message=message,
			details=details,
			user=request.user if request.user.is_authenticated else None,
		)

	def perform_create(self, serializer):  # type: ignore[override]
		user = serializer.save()
		self._log(
			self.request,
			SystemLog.Level.SUCCESS,
			"User created",
			f"User: {user.get_full_name() or user.username} | Email: {user.email}",
		)

	def perform_update(self, serializer):  # type: ignore[override]
		user = serializer.save()
		self._log(
			self.request,
			SystemLog.Level.INFO,
			"User updated",
			f"User: {user.get_full_name() or user.username} | Email: {user.email}",
		)

	def perform_destroy(self, instance):  # type: ignore[override]
		self._log(
			self.request,
			SystemLog.Level.WARNING,
			"User deleted",
			f"User: {instance.get_full_name() or instance.username} | Email: {instance.email}",
		)
		instance.delete()

	@action(detail=True, methods=["post"], url_path="toggle-status")
	def toggle_status(self, request, pk=None):
		user = self.get_object()
		user.is_active = not user.is_active
		user.save()
		self._log(
			request,
			SystemLog.Level.INFO,
			"User status toggled",
			f"User: {user.get_full_name() or user.username} | Email: {user.email} | Active: {user.is_active}",
		)
		serializer = self.get_serializer(user)
		return Response(serializer.data)
