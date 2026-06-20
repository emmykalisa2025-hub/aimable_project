import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trash2, Upload } from "lucide-react";
import UploadClaimsDialog from "@/components/dialogs/UploadClaimsDialog";
import InvestigationNoteDialog from "@/components/dialogs/InvestigationNoteDialog";
import { toast } from "@/hooks/use-toast";

interface FraudPredictionRow {
  voucher: string;
  backendId: number;
  beneficiary: string;
  totalAmount: number;
  fraudScore: number; // 0.00 - 1.00
  status: "Pending" | "Cleared";
  existingNote?: string;
}

interface UploadMeta {
  healthFacility: string | null;
  facilityCode: string | null;
  month: string | null;
  claimIds: number[];
}

export default function ClaimsReview() {
  const RECENT_UPLOADS_KEY = "aimable_recentUploads";
  const SHOW_PREDICTIONS_KEY = "aimable_showPredictions";

  const userName = sessionStorage.getItem("userName") || "Analyst";
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const accessToken = sessionStorage.getItem("accessToken");
  const queryClient = useQueryClient();
  const [selectedBackendIds, setSelectedBackendIds] = useState<number[]>([]);
  const [recentUploads, setRecentUploads] = useState<UploadMeta[]>([]);
  const predictionSectionRef = useRef<HTMLDivElement | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<number[]>([]);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<FraudPredictionRow | null>(null);
  const [suggestedNote, setSuggestedNote] = useState("");

  // Restore persisted upload batches and prediction visibility on mount
  useEffect(() => {
    try {
      const storedUploads = localStorage.getItem(RECENT_UPLOADS_KEY);
      if (storedUploads) {
        const parsed: UploadMeta[] = JSON.parse(storedUploads);
        if (Array.isArray(parsed)) {
          setRecentUploads(parsed);
        }
      }

      const storedShow = localStorage.getItem(SHOW_PREDICTIONS_KEY);
      if (storedShow !== null) {
        setShowPredictions(storedShow === "true");
      }
    } catch {
      // ignore JSON / storage errors and start fresh
    }
  }, []);

  // Persist uploads and prediction visibility when they change
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(recentUploads));
    } catch {
      // ignore storage errors
    }
  }, [recentUploads]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_PREDICTIONS_KEY, String(showPredictions));
    } catch {
      // ignore storage errors
    }
  }, [showPredictions]);

  const handleUploadClaims = (file: File) => {
    if (!accessToken) {
      toast({
        title: "Not authenticated",
        description: "Please log in again to upload claims.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    fetch("http://127.0.0.1:8000/api/claims/upload/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.detail || "Failed to upload claims file.";
          throw new Error(message);
        }
        return response.json();
      })
      .then((data) => {
        toast({
          title: "Claims uploaded",
          description:
            typeof data?.created === "number"
              ? `Claims file processed. ${data.created} new claim(s) created.`
              : "Claims file has been processed successfully.",
        });
        const meta = data?.meta || {};
        const ids: number[] = Array.isArray(data?.createdIds)
          ? data.createdIds
          : [];
        setRecentUploads((prev) => [
          {
            healthFacility: meta.healthFacility ?? null,
            facilityCode: meta.facilityCode ?? null,
            month: meta.month ?? null,
            claimIds: ids,
          },
          ...prev,
        ]);
        if (ids.length) {
          setShowPredictions(true);
          predictionSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          runPredictionsMutation.mutate(ids);
        }
        queryClient.invalidateQueries({ queryKey: ["claims", "predictions"] });
      })
      .catch((error: any) => {
        toast({
          title: "Upload failed",
          description: error.message || "An error occurred while uploading.",
          variant: "destructive",
        });
      });
  };

  const addNoteMutation = useMutation({
    mutationFn: async ({ claimId, note }: { claimId: number; note: string }) => {
      const response = await fetch(`http://127.0.0.1:8000/api/claims/${claimId}/add-note/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ note }),
      });

      if (!response.ok) {
        throw new Error("Failed to add note");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Note saved", description: "Investigation note added to claim." });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["claims", "predictions"] });
    },
    onError: () => {
      toast({
        title: "Failed to save note",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const runPredictionsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (!accessToken) {
        throw new Error("Not authenticated. Please log in again.");
      }

      for (const id of ids) {
        const response = await fetch("http://127.0.0.1:8000/api/ml/predict-claim-risk/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ claimId: id }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.detail || `Failed to run prediction for claim ${id}.`;
          throw new Error(message);
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Predictions updated",
        description: "Fraud scores have been refreshed for the selected claims.",
      });
      queryClient.invalidateQueries({ queryKey: ["claims", "predictions"] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: (error: any) => {
      toast({
        title: "Prediction failed",
        description: error?.message || "An error occurred while running predictions.",
        variant: "destructive",
      });
    },
  });

  const {
    data: predictions = [],
    isLoading,
    isError,
  } = useQuery<FraudPredictionRow[]>({
    queryKey: ["claims", "predictions"],
    queryFn: async () => {
      const response = await fetch("http://127.0.0.1:8000/api/claims/", {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load claims");
      }

      const data: any[] = await response.json();
      const rows: FraudPredictionRow[] = data.map((claim) => {
        let riskRaw =
          typeof claim.risk_score === "number"
            ? claim.risk_score
            : parseFloat(claim.risk_score || "0");

        if (riskRaw > 1) {
          riskRaw = riskRaw / 100;
        }

        const fraudScore = isNaN(riskRaw) ? 0 : riskRaw;

        const status: FraudPredictionRow["status"] =
          claim.review_status === "legitimate" && !claim.is_flagged && !claim.is_fraud
            ? "Cleared"
            : "Pending";

        return {
          backendId: claim.id,
          voucher: claim.claim_number,
          beneficiary: claim.policy_holder,
          totalAmount: parseFloat(claim.amount),
          fraudScore,
          status,
          existingNote: claim.notes ? String(claim.notes) : "",
        } as FraudPredictionRow;
      });

      rows.sort((a, b) => b.fraudScore - a.fraudScore);
      return rows;
    },
  });

  const getRiskLevel = (score: number) => {
    if (score <= 0.4) return "Low";
    if (score <= 0.7) return "Medium";
    return "High";
  };

  const getRiskColor = (score: number) => {
    if (score <= 0.4) return "bg-emerald-100 text-emerald-800";
    if (score <= 0.7) return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  };

  const getRiskDotColor = (score: number) => {
    if (score <= 0.4) return "bg-emerald-500";
    if (score <= 0.7) return "bg-amber-500";
    return "bg-red-500";
  };

  const submitNote = (note: string) => {
    if (!selectedClaim) return;
    addNoteMutation.mutate({ claimId: selectedClaim.backendId, note });
  };

  const handleInvestigate = (row: FraudPredictionRow) => {
    setSelectedClaim(row);
    // If a note was already saved on this claim, show it exactly as saved
    if (row.existingNote && row.existingNote.trim().length > 0) {
      setSuggestedNote(row.existingNote);
      setNoteDialogOpen(true);
      return;
    }

    // Otherwise, generate a suggestion from the model and rules
    if (!accessToken) {
      setSuggestedNote("");
      setNoteDialogOpen(true);
      toast({
        title: "Not authenticated",
        description: "Please log in again to save investigation notes.",
        variant: "destructive",
      });
      return;
    }

    fetch("http://127.0.0.1:8000/api/ml/predict-claim-risk/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ claimId: row.backendId }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.detail || "Failed to get model explanation.";
          throw new Error(message);
        }
        return response.json();
      })
      .then((data) => {
        const riskScore = typeof data?.riskScore === "number" ? data.riskScore : 0;
        const rules = data?.rules || {};
        const triggered: string[] = Array.isArray(rules.triggeredRules)
          ? rules.triggeredRules
          : [];

        let riskLabel = "Low";
        if (riskScore >= 70) riskLabel = "High";
        else if (riskScore >= 40) riskLabel = "Medium";

        const ruleText =
          triggered.length > 0
            ? `Rules triggered: ${triggered.join(", ")}.`
            : "No specific rule-based anomalies were triggered.";

        const suggestion =
          `Automated model assessment:\n` +
          `- Risk score: ${riskScore.toFixed(2)} (${riskLabel} risk).\n` +
          `- ${ruleText}\n` +
          `Analyst review: `;

        setSuggestedNote(suggestion);
        setNoteDialogOpen(true);
      })
      .catch((error: any) => {
        setSuggestedNote("");
        setNoteDialogOpen(true);
        toast({
          title: "Could not auto-generate note",
          description: error?.message || "Please write your investigation note manually.",
          variant: "destructive",
        });
      });
  };

  const toggleSelection = (backendId: number) => {
    setSelectedBackendIds((prev) =>
      prev.includes(backendId) ? prev.filter((id) => id !== backendId) : [...prev, backendId],
    );
  };

  const deleteClaimsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch("http://127.0.0.1:8000/api/claims/bulk-delete/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.detail || "Failed to delete claims";
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (_data, ids) => {
      setSelectedBackendIds([]);
      toast({ title: "Claims deleted", description: "Selected claims have been removed." });
      // Remove deleted claims from local upload batches
      setRecentUploads((prev) =>
        prev
          .map((u) => ({
            ...u,
            claimIds: u.claimIds.filter((id) => !ids.includes(id)),
          }))
          .filter((u) => u.claimIds.length > 0),
      );
      queryClient.invalidateQueries({ queryKey: ["claims", "predictions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete claims",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteSelected = () => {
    if (!selectedBackendIds.length) return;
    setDeleteIds(selectedBackendIds);
    setDeleteDialogOpen(true);
  };

  const allSelected =
    predictions.length > 0 && selectedBackendIds.length === predictions.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedBackendIds([]);
    } else {
      setSelectedBackendIds(predictions.map((p) => p.backendId));
    }
  };

  return (
    <AppLayout userRole="analyst" userName={userName}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims Review</h1>
            <p className="text-gray-600 mt-2">
              Upload and review medical claims flagged by the system.
            </p>
          </div>
          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Claims
          </Button>
        </div>

        {/* Summary / Placeholder Content */}
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Claims</CardTitle>
            <CardDescription>
              This is a placeholder view. Once backend integration is ready, uploaded
              claims will be listed here for detailed review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Use the <span className="font-semibold">Upload Claims</span> button above to
              submit a new Excel or CSV file. The system will process and score the claims
              for fraud risk.
            </p>
          </CardContent>
        </Card>

        {/* Upload batches summary (local to this page) */}
        {recentUploads.length > 0 && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Uploaded Voucher Batches</CardTitle>
                <CardDescription>
                  HEALTH FACILITY, CODE / HEALTH CACILITY, MONTH
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Health Facility</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Code / Health Cacility</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Month</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUploads.map((u, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900">{u.healthFacility || "-"}</td>
                        <td className="py-3 px-4 text-gray-900">{u.facilityCode || "-"}</td>
                        <td className="py-3 px-4 text-gray-900">{u.month || "-"}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowPredictions((prev) => {
                                  const next = !prev;
                                  if (!prev && predictionSectionRef.current) {
                                    predictionSectionRef.current.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                  }
                                  return next;
                                });
                              }}
                            >
                              {showPredictions ? "Hide" : "View"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!u.claimIds.length || runPredictionsMutation.isPending}
                              onClick={() => {
                                if (!u.claimIds.length) return;
                                setShowPredictions(true);
                                predictionSectionRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                                runPredictionsMutation.mutate(u.claimIds);
                              }}
                            >
                              Run predictions
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              disabled={!u.claimIds.length}
                              onClick={() => {
                                if (!u.claimIds.length) return;
                                setDeleteIds(u.claimIds);
                                setDeleteDialogOpen(true);
                              }}
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
        )}

        {/* Fraud Prediction Table */}
        <div ref={predictionSectionRef}>
        {showPredictions && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Fraud Prediction Table</CardTitle>
                <CardDescription>
                  Latest model predictions for uploaded claims, with color-coded risk levels.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!predictions.length || runPredictionsMutation.isPending}
                  onClick={() => {
                    if (!predictions.length) return;
                    const ids = predictions.map((p) => p.backendId);
                    runPredictionsMutation.mutate(ids);
                  }}
                >
                  Run predictions for all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedBackendIds.length}
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <p className="text-sm text-gray-600 mb-4">Loading predictions...</p>
            )}
            {isError && (
              <p className="text-sm text-red-600 mb-4">
                Failed to load predictions. Please refresh the page.
              </p>
            )}
            {!isLoading && !isError && predictions.length === 0 && (
              <p className="text-sm text-gray-600 mb-4">
                No claims available yet. Upload claims to see predictions.
              </p>
            )}
            {/* Risk legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>0.00 – 0.40 → Low Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>0.41 – 0.70 → Medium Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>0.71 – 1.00 → High Risk</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 text-center py-3 px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Voucher</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Beneficiary</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Amount</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Fraud Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Risk</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((row) => {
                    const riskLevel = getRiskLevel(row.fraudScore);
                    return (
                      <tr key={row.voucher} className="border-t hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer"
                            checked={selectedBackendIds.includes(row.backendId)}
                            onChange={() => toggleSelection(row.backendId)}
                          />
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{row.voucher}</td>
                        <td className="py-3 px-4 text-gray-700">{row.beneficiary}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">
                          {row.totalAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-900 font-mono">
                          {row.fraudScore.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(
                              row.fraudScore,
                            )}`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${getRiskDotColor(row.fraudScore)}`}
                            />
                            {riskLevel} Risk
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                              row.status === "Pending"
                                ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleInvestigate(row)}
                              className="text-teal-700 hover:text-teal-900 text-xs font-semibold underline"
                            >
                              {row.status === "Pending" ? "Investigate" : "View"}
                            </button>
                            <button
                              onClick={() => {
                                setDeleteIds([row.backendId]);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold underline flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}
        </div>
      </div>

      <UploadClaimsDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSubmit={handleUploadClaims}
      />

      {selectedClaim && (
        <InvestigationNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          claimId={selectedClaim.voucher}
          initialNote={suggestedNote}
          onSubmit={submitNote}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete claim{deleteIds.length > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. {deleteIds.length > 1 ? "These claims will" : "This claim will"} be
              permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteIds.length) return;
                deleteClaimsMutation.mutate(deleteIds);
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
