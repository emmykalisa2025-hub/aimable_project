from rest_framework import serializers

from .models import ModelRun


class ModelRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelRun
        fields = [
            "id",
            "created_at",
            "updated_at",
            "name",
            "status",
            "parameters",
            "metrics",
        ]
