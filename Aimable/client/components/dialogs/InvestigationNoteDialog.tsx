import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface InvestigationNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  onSubmit: (note: string) => void;
  initialNote?: string;
}

export default function InvestigationNoteDialog({
  open,
  onOpenChange,
  claimId,
  onSubmit,
  initialNote,
}: InvestigationNoteDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNote(initialNote || "");
      setError("");
    }
  }, [open, initialNote]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!note.trim()) {
      setError("Note cannot be empty");
      return;
    }

    if (note.length < 10) {
      setError("Note must be at least 10 characters long");
      return;
    }

    onSubmit(note);
    setNote("");
    setError("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNote("");
      setError("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Investigation Note</DialogTitle>
          <DialogDescription>
            Add detailed notes for claim {claimId}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Claim Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-600">Claim ID</p>
            <p className="font-semibold text-gray-900">{claimId}</p>
          </div>

          {/* Note Text Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Investigation Notes
            </label>
            <textarea
              name="investigationNote"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setError("");
              }}
              placeholder="Enter your investigation notes here... Include observations, findings, and any suspicious patterns detected."
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-32 ${
                error ? "border-red-500" : "border-gray-300"
              }`}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-gray-500">
                {note.length} / 500 characters
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          </div>

          {/* Note Guidelines */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Note Guidelines:
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Describe suspicious patterns or anomalies detected</li>
              <li>• Reference any supporting evidence or data</li>
              <li>• Note any follow-up actions needed</li>
              <li>• Include timestamp for investigation milestones</li>
            </ul>
          </div>
        </form>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleSubmit}
            disabled={!note.trim() || note.length < 10}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Save Note
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
