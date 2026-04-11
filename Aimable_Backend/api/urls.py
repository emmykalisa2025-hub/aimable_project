from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"claims", views.ClaimViewSet, basename="claim")
router.register(r"admin/users", views.AdminUserViewSet, basename="admin-users")
router.register(r"admin/system-logs", views.SystemLogViewSet, basename="system-logs")

urlpatterns = [
    path("health/", views.health_check, name="health_check"),
    path("summary/", views.dashboard_summary, name="dashboard_summary"),
    path("me/", views.current_user, name="current_user"),
    path("", include(router.urls)),
]
