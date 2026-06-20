from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from ...models import UserProfile


class Command(BaseCommand):
    help = "Create initial users with roles for local development"

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            dest="password",
            default="changeme123",
            help="Default password to set for created users",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            dest="force",
            help="If set, update existing users' password and role",
        )

    def handle(self, *args, **options):
        password = options.get("password")
        force = options.get("force", False)

        users = [
            {
                "username": "admin",
                "email": "admin@example.com",
                "first_name": "System",
                "last_name": "Admin",
                "role": UserProfile.Role.ADMIN,
            },
            {
                "username": "analyst1",
                "email": "analyst1@example.com",
                "first_name": "Alice",
                "last_name": "Analyst",
                "role": UserProfile.Role.ANALYST,
            },
            {
                "username": "scientist1",
                "email": "scientist1@example.com",
                "first_name": "Data",
                "last_name": "Scientist",
                "role": UserProfile.Role.SCIENTIST,
            },
            {
                "username": "facility1",
                "email": "facility1@example.com",
                "first_name": "Facility",
                "last_name": "User",
                "role": UserProfile.Role.FACILITY,
            },
        ]

        for u in users:
            user_obj, created = User.objects.get_or_create(
                username=u["username"],
                defaults={
                    "email": u["email"],
                    "first_name": u["first_name"],
                    "last_name": u["last_name"],
                },
            )

            if created:
                user_obj.set_password(password)
                user_obj.is_active = True
                user_obj.save()
                UserProfile.objects.update_or_create(user=user_obj, defaults={"role": u["role"]})
                self.stdout.write(self.style.SUCCESS(f"Created user: {user_obj.username} ({u['role']})"))
            else:
                if force:
                    user_obj.set_password(password)
                    user_obj.email = u["email"]
                    user_obj.first_name = u["first_name"]
                    user_obj.last_name = u["last_name"]
                    user_obj.is_active = True
                    user_obj.save()
                    UserProfile.objects.update_or_create(user=user_obj, defaults={"role": u["role"]})
                    self.stdout.write(self.style.SUCCESS(f"Updated user: {user_obj.username} (password/role reset)"))
                else:
                    self.stdout.write(self.style.WARNING(f"User exists: {user_obj.username} - use --force to update"))

        self.stdout.write(self.style.NOTICE("Seeding complete. Change passwords immediately for production."))
