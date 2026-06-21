import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainModelDialog } from "@/components/dialogs/TrainModelDialog";
import { ModelDetailsDialog, ModelDetails } from "@/components/dialogs/ModelDetailsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Activity, Zap, Award, TrendingUp } from "lucide-react";
import { api } from "@/lib/config";

interface ModelMetrics {
  id: number;
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  status: "training" | "testing" | "deployed";
  createdAt?: string;
  updatedAt?: string;
  parameters?: Record<string, any> | null;
  rawMetrics?: Record<string, any> | null;
}

interface BackendModelRun {
  id: number;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  parameters: Record<string, any> | null;
  metrics: Record<string, any> | null;
}

export default function ScientistDashboard() {
  const userName = sessionStorage.getItem("userName") || "Scientist";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelMetrics | null>(null);
  const [deployTarget, setDeployTarget] = useState<ModelMetrics | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelMetrics | null>(null);
  const queryClient = useQueryClient();

  const accessToken = sessionStorage.getItem("accessToken");

  const mapBackendRunToModelMetrics = (run: BackendModelRun): ModelMetrics => {
    const metrics = run.metrics || {};
    const accuracy = typeof metrics.accuracy === "number" ? metrics.accuracy : 0;
    const precision = typeof metrics.precision === "number" ? metrics.precision : 0;
    const recall = typeof metrics.recall === "number" ? metrics.recall : 0;
    const f1 =
      typeof metrics.f1 === "number"
        ? metrics.f1
        : typeof metrics.f1_score === "number"
          ? metrics.f1_score
          : 0;

    let status: ModelMetrics["status"] = "testing";
    if (run.status === "deployed") status = "deployed";
    else if (run.status === "training" || run.status === "pending") status = "training";

    return {
      id: run.id,
      name: run.name,
      accuracy,
      precision,
      recall,
      f1Score: f1,
      status,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      parameters: run.parameters,
      rawMetrics: metrics,
    };
  };

  const fetchModelRuns = async (): Promise<ModelMetrics[]> => {
    const response = await fetch(api("/api/ml/model-runs/"), {
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load model runs");
    }

    const data: BackendModelRun[] = await response.json();
    return data.map(mapBackendRunToModelMetrics);
  };

  const {
    data: models = [],
    isLoading,
    isError,
  } = useQuery<ModelMetrics[]>({
    queryKey: ["ml", "model-runs"],
    queryFn: fetchModelRuns,
  });

  const getStatusColor = (status: string) => {
    if (status === "deployed") return "bg-green-100 text-green-800";
    if (status === "training") return "bg-orange-100 text-orange-800";
    return "bg-blue-100 text-blue-800";
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const trainModelMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const payload = {
        name: formData.modelName,
        status: "training",
        parameters: formData,
      };

      const response = await fetch(api("/api/ml/model-runs/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to start model training");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml", "model-runs"] });
      toast({
        title: "Model created",
        description: "Training configuration submitted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Model creation failed",
        description: "Could not start model training. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTrainModel = (formData: Record<string, string>) => {
    trainModelMutation.mutate(formData);
  };

  const updateModelMutation = useMutation({
    mutationFn: async (args: { id: number; data: Partial<{ name: string; status: string }> }) => {
      const response = await fetch(api(`/api/ml/model-runs/${args.id}/`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(args.data),
      });

      if (!response.ok) {
        let message = "Failed to update model run";
        try {
          const err = await response.json();
          if (typeof err.detail === "string") {
            message = err.detail;
          }
        } catch {
          // ignore JSON parse errors and fall back to default message
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml", "model-runs"] });
      toast({
        title: "Model updated",
        description: "Changes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error?.message || "Failed to update model. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeploy = (model: ModelMetrics) => {
    setDeployTarget(model);
  };

  const deleteModelMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(api(`/api/ml/model-runs/${id}/`), {
        method: "DELETE",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete model run");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml", "model-runs"] });
      toast({
        title: "Model deleted",
        description: "The model run has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Could not delete model. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleShowDetails = (model: ModelMetrics) => {
    setSelectedModel(model);
    setDetailsOpen(true);
  };

  const handleUpdateFromDetails = (id: number, data: Partial<Pick<ModelDetails, "name" | "status">>) => {
    updateModelMutation.mutate({ id, data });
  };

  return (
    <AppLayout userRole="scientist" userName={userName}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ML Model Management</h1>
          <p className="text-gray-600 mt-2">Develop, evaluate, and deploy fraud detection models</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Models in Deployment</CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {models.filter((m) => m.status === "deployed").length}
              </div>
              <p className="text-xs text-gray-600 mt-1">Production ready</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Models in Testing</CardTitle>
              <Activity className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {models.filter((m) => m.status === "testing").length}
              </div>
              <p className="text-xs text-gray-600 mt-1">Under evaluation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Best F1-Score</CardTitle>
              <Award className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {models.length > 0
                  ? `${Math.max(...models.map((m) => m.f1Score)).toFixed(2)}%`
                  : "-"}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {models.length > 0
                  ? models.reduce((best, current) =>
                      current.f1Score > best.f1Score ? current : best,
                    models[0],
                  ).name
                  : "No runs yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Training</CardTitle>
              <TrendingUp className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {models.length > 0 ? "Active" : "-"}
              </div>
              <p className="text-xs text-gray-600 mt-1">Since last retraining</p>
            </CardContent>
          </Card>
        </div>

        {/* Model Comparison */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Model Performance Comparison</CardTitle>
                <CardDescription>Metrics across all trained models</CardDescription>
              </div>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setDialogOpen(true)}
              >
                Train New Model
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Model Name</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Accuracy</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Precision</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Recall</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">F1-Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="py-4 px-4 text-sm text-gray-500" colSpan={7}>
                        Loading model runs...
                      </td>
                    </tr>
                  )}
                  {isError && !isLoading && (
                    <tr>
                      <td className="py-4 px-4 text-sm text-red-600" colSpan={7}>
                        Failed to load model runs.
                      </td>
                    </tr>
                  )}
                  {!isLoading && !isError && models.map((model) => (
                    <tr key={model.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4 font-medium text-gray-900">{model.name}</td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${model.accuracy}%` }}
                            ></div>
                          </div>
                          <span className="text-gray-900 font-semibold">{model.accuracy}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-semibold text-gray-900">
                        {model.precision}%
                      </td>
                      <td className="py-4 px-4 text-center font-semibold text-gray-900">
                        {model.recall}%
                      </td>
                      <td className="py-4 px-4 text-center font-semibold text-gray-900">
                        {model.f1Score}%
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(model.status)}`}>
                          {getStatusLabel(model.status)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {model.status !== "deployed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs"
                              onClick={() => handleDeploy(model)}
                              disabled={updateModelMutation.isPending}
                            >
                              Deploy
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleShowDetails(model)}
                          >
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 px-2 text-xs"
                            onClick={() => setDeleteTarget(model)}
                            disabled={deleteModelMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Training & Evaluation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ROC-AUC Curves */}
          <Card>
            <CardHeader>
              <CardTitle>ROC-AUC Performance</CardTitle>
              <CardDescription>Receiver Operating Characteristic curves</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {models.map((model) => (
                <div key={model.id}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{model.name.split("(")[0].trim()}</span>
                    <span className="text-sm font-semibold text-gray-900">AUC: 0.{Math.round(model.f1Score)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${model.f1Score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Data Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Training Data Overview</CardTitle>
              <CardDescription>Latest training dataset statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Records</p>
                  <p className="text-2xl font-bold text-gray-900">45,234</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Legitimate Claims</p>
                  <p className="text-2xl font-bold text-gray-900">43,521</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Fraudulent Claims</p>
                  <p className="text-2xl font-bold text-gray-900">1,713</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Class Imbalance</p>
                  <p className="text-2xl font-bold text-gray-900">3.8%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Experiments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Experiments</CardTitle>
            <CardDescription>Latest model training and evaluation runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {models.length === 0 && (
                <p className="text-sm text-gray-600">
                  No experiments yet. Start by training a new model.
                </p>
              )}
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{model.name}</p>
                    <p className="text-sm text-gray-600">Status: {getStatusLabel(model.status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      F1-Score: {model.f1Score ? `${model.f1Score.toFixed(2)}%` : "-"}
                    </p>
                    <p className="text-xs text-green-600 font-medium">Tracked run</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Train Model Dialog */}
        <TrainModelDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleTrainModel}
        />

        {/* Confirm deploy dialog */}
        <AlertDialog open={!!deployTarget} onOpenChange={(open) => !open && setDeployTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deploy model?</AlertDialogTitle>
              <AlertDialogDescription>
                {deployTarget
                  ? `Deploy model "${deployTarget.name}" to production? This will mark it as deployed.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updateModelMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!deployTarget) return;
                  updateModelMutation.mutate({
                    id: deployTarget.id,
                    data: { status: "deployed" },
                  });
                  setDeployTarget(null);
                }}
                disabled={updateModelMutation.isPending}
              >
                Deploy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm delete dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete model run?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `This will permanently remove "${deleteTarget.name}" and its metrics.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteModelMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteModelMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                disabled={deleteModelMutation.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ModelDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          model={
            selectedModel
              ? {
                  id: selectedModel.id,
                  name: selectedModel.name,
                  status: selectedModel.status,
                  createdAt: selectedModel.createdAt,
                  updatedAt: selectedModel.updatedAt,
                  parameters: selectedModel.parameters,
                  metrics: selectedModel.rawMetrics,
                }
              : null
          }
          onUpdate={handleUpdateFromDetails}
          isUpdating={updateModelMutation.isPending}
        />
      </div>
    </AppLayout>
  );
}
