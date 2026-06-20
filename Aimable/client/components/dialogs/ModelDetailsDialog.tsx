import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ModelDetails {
  id: number;
  name: string;
  status: "training" | "testing" | "deployed";
  createdAt?: string;
  updatedAt?: string;
  parameters?: Record<string, any> | null;
  metrics?: Record<string, any> | null;
}

interface ModelDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: ModelDetails | null;
  onUpdate?: (id: number, data: Partial<Pick<ModelDetails, "name" | "status">>) => void;
  isUpdating?: boolean;
}

export function ModelDetailsDialog({
  open,
  onOpenChange,
  model,
  onUpdate,
  isUpdating,
}: ModelDetailsDialogProps) {
  if (!model) return null;

  const [name, setName] = useState(model.name);
  const [status, setStatus] = useState<ModelDetails["status"]>(model.status);

  useEffect(() => {
    if (model) {
      setName(model.name);
      setStatus(model.status);
    }
  }, [model]);

  const handlePromoteToDeployed = () => {
    if (!onUpdate) return;
    onUpdate(model.id, { status: "deployed" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Model Details</DialogTitle>
          <DialogDescription>
            Full configuration and metrics for this model run.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 text-sm text-gray-800">
          {/* Basic Info */}
          <section className="space-y-2">
            <h3 className="font-semibold text-gray-900">Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isUpdating}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <select
                  className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ModelDetails["status"])}
                  disabled={isUpdating}
                >
                  <option value="training">Training</option>
                  <option value="testing">Testing</option>
                  <option value="deployed">Deployed</option>
                </select>
              </div>
              {model.createdAt && (
                <div>
                  <p className="text-xs text-gray-500">Created At</p>
                  <p className="font-medium">{model.createdAt}</p>
                </div>
              )}
              {model.updatedAt && (
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="font-medium">{model.updatedAt}</p>
                </div>
              )}
            </div>
          </section>

          {/* Metrics */}
          <section className="space-y-2">
            <h3 className="font-semibold text-gray-900">Metrics</h3>
            {model.metrics && Object.keys(model.metrics).length > 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 space-y-1 font-mono text-xs">
                {Object.entries(model.metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <span className="text-gray-600">{key}</span>
                    <span className="text-gray-900">{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No metrics have been recorded for this run yet.</p>
            )}
          </section>

          {/* Parameters */}
          <section className="space-y-2">
            <h3 className="font-semibold text-gray-900">Training Configuration</h3>
            {model.parameters && Object.keys(model.parameters).length > 0 ? (
              <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(model.parameters, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-gray-600">No configuration parameters were stored for this run.</p>
            )}
          </section>
        </div>

        <DialogFooter className="gap-3">
          {onUpdate && (
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => onUpdate(model.id, { name, status })}
              disabled={isUpdating}
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          )}
          {model.status !== "deployed" && onUpdate && (
            <Button
              type="button"
              variant="default"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={handlePromoteToDeployed}
              disabled={isUpdating}
            >
              {isUpdating ? "Updating..." : "Deploy Model"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
