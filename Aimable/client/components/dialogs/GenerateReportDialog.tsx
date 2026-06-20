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
import { FileText, Download } from "lucide-react";

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  onSubmit: (reportType: string) => void;
}

const reportTypes = [
  {
    id: "investigation",
    label: "Investigation Report",
    description: "Detailed findings and analysis of the claim investigation",
    icon: "📋",
  },
  {
    id: "fraud_assessment",
    label: "Fraud Assessment Report",
    description: "Risk evaluation and fraud probability assessment",
    icon: "⚠️",
  },
  {
    id: "summary",
    label: "Summary Report",
    description: "Quick overview of key findings and recommendations",
    icon: "📄",
  },
  {
    id: "audit_trail",
    label: "Audit Trail Report",
    description: "Complete history of all actions and notes on this claim",
    icon: "📝",
  },
];

export default function GenerateReportDialog({
  open,
  onOpenChange,
  claimId,
  onSubmit,
}: GenerateReportDialogProps) {
  const [selectedReportType, setSelectedReportType] = useState("investigation");
  const [includeDetails, setIncludeDetails] = useState({
    predictions: true,
    notes: true,
    evidence: true,
    recommendations: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    // Simulate report generation delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    onSubmit(selectedReportType);
    setIsGenerating(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Report
          </DialogTitle>
          <DialogDescription>
            Create an investigation report for claim {claimId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {reportTypes.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportType(report.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    selectedReportType === report.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">{report.icon}</div>
                  <p className="font-semibold text-sm text-gray-900">
                    {report.label}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {report.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Include Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Include in Report
            </label>
            <div className="space-y-2">
              {[
                { key: "predictions", label: "Fraud Prediction Scores" },
                { key: "notes", label: "Investigation Notes" },
                { key: "evidence", label: "Evidence & Documentation" },
                { key: "recommendations", label: "Recommendations" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDetails[key as keyof typeof includeDetails]}
                    onChange={(e) =>
                      setIncludeDetails({
                        ...includeDetails,
                        [key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Report Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-2">
              Report Details:
            </p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Report will be generated in PDF format</li>
              <li>• Includes timestamp and analyst signature</li>
              <li>• Suitable for official documentation</li>
              <li>• Can be shared with stakeholders</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Generate & Download
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
