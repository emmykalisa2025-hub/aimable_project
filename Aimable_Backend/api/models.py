from django.contrib.auth.models import User
from django.db import models


class Claim(models.Model):
	"""Basic insurance claim model for fraud analysis.

	Augmented to support Fraud Analyst workflows described in Chapter 4:
	- `risk_score` stores the ML anomaly/fraud score for the claim.
	- `review_status` captures the analyst's decision state.
	- `notes` aggregates investigation notes (one per line) for now.
	"""

	class ReviewStatus(models.TextChoices):
		PENDING = "pending", "Pending"
		INVESTIGATION = "investigation", "Under investigation"
		FRAUDULENT = "fraudulent", "Fraudulent"
		LEGITIMATE = "legitimate", "Legitimate"

	claim_number = models.CharField(max_length=64, unique=True)
	policy_holder = models.CharField(max_length=255)
	# Total amount claimed for the voucher/beneficiary.
	amount = models.DecimalField(max_digits=12, decimal_places=2)
	# Optional cost breakdown components used for ML features.
	consultation_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	laboratory_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	imaging_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	procedures_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	medicines_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	service_date = models.DateField(null=True, blank=True)
	is_flagged = models.BooleanField(default=False)
	is_fraud = models.BooleanField(default=False)
	risk_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # 0-100
	review_status = models.CharField(
		max_length=32,
		choices=ReviewStatus.choices,
		default=ReviewStatus.PENDING,
	)
	notes = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.claim_number} - {self.policy_holder}"


class UserProfile(models.Model):
	"""Additional information and role for a Django user."""

	class Role(models.TextChoices):
		ADMIN = "admin", "System Administrator"
		ANALYST = "analyst", "Fraud Analyst"
		SCIENTIST = "scientist", "Data Scientist"
		FACILITY = "facility", "Health Facility"

	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
	role = models.CharField(max_length=32, choices=Role.choices, default=Role.ANALYST)

	def __str__(self) -> str:  # pragma: no cover
		return f"{self.user.username} ({self.role})"


class SystemLog(models.Model):
	"""Simple audit log for admin System Logs page."""

	class Level(models.TextChoices):
		INFO = "info", "Info"
		WARNING = "warning", "Warning"
		ERROR = "error", "Error"
		SUCCESS = "success", "Success"

	timestamp = models.DateTimeField(auto_now_add=True)
	level = models.CharField(max_length=16, choices=Level.choices, default=Level.INFO)
	source = models.CharField(max_length=128)
	message = models.TextField()
	details = models.TextField(blank=True)
	user = models.ForeignKey(
		User,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="system_logs",
	)

	def __str__(self) -> str:  # pragma: no cover
		return f"[{self.level}] {self.source}: {self.message[:50]}"
