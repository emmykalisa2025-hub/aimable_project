from typing import Any, Dict

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Claim, UserProfile, SystemLog


class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = [
            "id",
            "claim_number",
            "policy_holder",
			"consultation_cost",
			"laboratory_cost",
			"imaging_cost",
			"procedures_cost",
			"medicines_cost",
            "amount",
            "is_flagged",
            "is_fraud",
            "risk_score",
            "review_status",
            "notes",
            "created_at",
            "updated_at",
        ]


class SystemLogSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")
    userId = serializers.SerializerMethodField()

    class Meta:
        model = SystemLog
        fields = [
            "id",
            "timestamp",
            "level",
            "source",
            "message",
            "details",
            "userId",
        ]

    def get_userId(self, obj: SystemLog) -> str:
        user = obj.user
        if not user:
            return ""
        return user.email or user.username or ""


class AdminUserSerializer(serializers.Serializer):
    """Serializer for system admin user management views.

    Maps Django's User + UserProfile into the shape expected by the frontend.
    """

    id = serializers.IntegerField(read_only=True)
    # Full display name (optional, derived from first/last where possible)
    name = serializers.CharField(required=False, allow_blank=True)
    # Explicit name fields and username for login
    firstName = serializers.CharField(required=False, allow_blank=True)
    lastName = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=UserProfile.Role.choices)
    status = serializers.ChoiceField(choices=[("active", "active"), ("inactive", "inactive")])
    createdAt = serializers.CharField(read_only=True)
    lastLogin = serializers.CharField(read_only=True, allow_blank=True)

    def to_representation(self, instance: User) -> Dict[str, Any]:
        profile = getattr(instance, "profile", None)
        full_name = instance.get_full_name() or instance.username or instance.email
        role = profile.role if profile else UserProfile.Role.ANALYST
        status = "active" if instance.is_active else "inactive"
        created_at = instance.date_joined.date().isoformat() if instance.date_joined else ""
        last_login = (
            instance.last_login.date().isoformat() if instance.last_login else ""
        )
        return {
            "id": instance.id,
            "name": full_name,
            "firstName": instance.first_name or "",
            "lastName": instance.last_name or "",
            "username": instance.username,
            "email": instance.email,
            "role": role,
            "status": status,
            "createdAt": created_at,
            "lastLogin": last_login,
        }

    def create(self, validated_data: Dict[str, Any]) -> User:
        # Prefer explicit first/last/username, but fall back to "name" and email.
        name = (validated_data.pop("name", "") or "").strip()
        first_name = (validated_data.pop("firstName", "") or "").strip()
        last_name = (validated_data.pop("lastName", "") or "").strip()
        username = (validated_data.pop("username", "") or "").strip()
        role = validated_data.pop("role")
        status = validated_data.pop("status", "active")
        email = validated_data["email"]

        if not first_name and not last_name and name:
            parts = name.split(" ", 1)
            first_name = parts[0]
            if len(parts) == 2:
                last_name = parts[1]

        if not username:
            username = email

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password="changeme123",  # TODO: implement proper password handling
        )
        user.is_active = status == "active"
        user.save()

        UserProfile.objects.update_or_create(
            user=user,
            defaults={"role": role},
        )
        return user

    def update(self, instance: User, validated_data: Dict[str, Any]) -> User:
        name = validated_data.pop("name", None)
        first_name = validated_data.pop("firstName", None)
        last_name = validated_data.pop("lastName", None)
        username = validated_data.pop("username", None)
        role = validated_data.pop("role", None)
        status = validated_data.pop("status", None)
        email = validated_data.get("email")

        if first_name is not None:
            instance.first_name = first_name.strip()

        if last_name is not None:
            instance.last_name = last_name.strip()

        if name is not None and not (first_name or last_name):
            name = name.strip()
            parts = name.split(" ", 1)
            instance.first_name = parts[0]
            instance.last_name = parts[1] if len(parts) == 2 else ""

        if email is not None:
            instance.email = email

        if username is not None:
            instance.username = username
        elif email is not None:
            instance.username = email

        if status is not None:
            instance.is_active = status == "active"

        instance.save()

        if role is not None:
            UserProfile.objects.update_or_create(
                user=instance,
                defaults={"role": role},
            )

        return instance
