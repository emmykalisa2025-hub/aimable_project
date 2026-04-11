from django.db import models


class ModelRun(models.Model):
    """Tracks a single ML model run or analysis job."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=32, default="pending")
    parameters = models.JSONField(default=dict, blank=True)
    metrics = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.status})"
