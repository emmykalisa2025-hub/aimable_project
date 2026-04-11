from django.urls import path

from .views import ModelRunListCreateView, ModelRunDetailView, PredictClaimRiskView


urlpatterns = [
    path("model-runs/", ModelRunListCreateView.as_view(), name="ml-model-run-list-create"),
    path("model-runs/<int:pk>/", ModelRunDetailView.as_view(), name="ml-model-run-detail"),
    path("predict-claim-risk/", PredictClaimRiskView.as_view(), name="ml-predict-claim-risk"),
]
