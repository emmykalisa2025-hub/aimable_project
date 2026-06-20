import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type FraudStatus = "flagged" | "suspicious" | "fraudulent";

interface MarkFraudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  provider: string;
  amount: number;
  onSubmit: (status: FraudStatus, reason: string) => void;
}

const fraudOptions: Array<{
  id: FraudStatus;
  label: string;
  description: string;
  color: string;
}> = [
  {
    id: "flagged",
    label: "Flagged for Review",
    description: "Minor inconsistencies detected, requires further review",
    color: "bg-yellow-50 border-yellow-200",
  },
  {
    id: "suspicious",
    label: "Suspicious Activity",
    description: "Multiple indicators of potential fraud detected",
    color: "bg-orange-50 border-orange-200",
  },
  {
    id: "fraudulent",
    label: "Mark as Fraudulent",
    description: "Strong evidence of fraud, claim will be rejected",
    color: "bg-red-50 border-red-200",
  },
];

export default function MarkFraudDialog({
  open,
  onOpenChange,
  claimId,
  provider,
  amount,
  onSubmit,
}: MarkFraudDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<FraudStatus>("suspicious");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError("Please provide a reason for this action");
      return;
    }

    if (reason.length < 15) {
      setError("Reason must be at least 15 characters long");
      return;
    }

    onSubmit(selectedStatus, reason);
    setReason("");
    setError("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason("");
      setError("");
      setSelectedStatus("suspicious");
    }
    onOpenChange(newOpen);
  };

  const selectedOption = fraudOptions.find((opt) => opt.id === selectedStatus);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            Mark Claim Status
          </DialogTitle>
          <DialogDescription>
            Update the fraud status for claim {claimId}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Claim Info */}
          <div className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">Claim ID</p>
              <p className="font-semibold text-gray-900">{claimId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Provider</p>
              <p className="font-semibold text-gray-900">{provider}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Amount</p>
              <p className="font-semibold text-gray-900">
                RWF {amount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Status Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Status
            </label>
            <div className="space-y-2">
              {fraudOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedStatus(option.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedStatus === option.id
                      ? `border-orange-400 ${option.color.replace("border-", "border-orange-400 ")}`
                      : `border-gray-200 bg-white hover:border-gray-300 ${option.color}`
                  }`}
                >
                  <p className="font-semibold text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Reason Text Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Status Change
            </label>
            <textarea
              name="fraudReason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder="Explain the reason for marking this claim with the selected status... Include specific evidence or patterns observed."
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none h-24 ${
                error ? "border-red-500" : "border-gray-300"
              }`}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-gray-500">
                {reason.length} / 300 characters
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          </div>

          {/* Warning for Fraudulent */}
          {selectedStatus === "fraudulent" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-800 font-semibold">
                ⚠️ Warning: This will mark the claim as fraudulent and reject it.
                This action should only be taken with strong evidence.
              </p>
            </div>
          )}
        </form>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || reason.length < 15}
            className={`text-white disabled:bg-gray-400 flex items-center gap-2 ${
              selectedStatus === "fraudulent"
                ? "bg-red-600 hover:bg-red-700"
                : selectedStatus === "suspicious"
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-yellow-600 hover:bg-yellow-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Confirm Status
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
