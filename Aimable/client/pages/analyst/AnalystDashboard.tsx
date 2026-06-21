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
import { AlertCircle, CheckCircle, Clock, TrendingUp, Upload, AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/config";
import UploadClaimsDialog from "@/components/dialogs/UploadClaimsDialog";
import InvestigationNoteDialog from "@/components/dialogs/InvestigationNoteDialog";
import MarkFraudDialog from "@/components/dialogs/MarkFraudDialog";
import GenerateReportDialog from "@/components/dialogs/GenerateReportDialog";

type FraudStatus = "flagged" | "suspicious" | "fraudulent" | "pending";

interface ClaimData {
  id: string;
  backendId: number;
  provider: string;
  amount: number;
  riskScore: number;
  status: FraudStatus;
  date: string;
  investigationNotes: string[];
}

interface UploadMeta {
  healthFacility: string | null;
  facilityCode: string | null;
  month: string | null;
  claimIds: number[];
}

export default function AnalystDashboard() {
  const userName = sessionStorage.getItem("userName") || "Analyst";
  const location = useLocation();
  const navigate = useNavigate();
  const focusVoucher = (location.state as { focusVoucher?: string } | null)?.focusVoucher;
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [autoFocusHandled, setAutoFocusHandled] = useState(false);
  const [focusedVoucher] = useState<string | null>(focusVoucher || null);
  const [recentUploads, setRecentUploads] = useState<UploadMeta[]>([]);
  const [selectedBackendIds, setSelectedBackendIds] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  const accessToken = sessionStorage.getItem("accessToken");

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [fraudDialogOpen, setFraudDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimData | null>(null);
  const [suggestedNote, setSuggestedNote] = useState<string>("");

  const stats = {
  totalClaimsUploaded: claims.length,
  highRiskClaims: claims.filter((c) => c.riskScore >= 70 || c.status === "suspicious" || c.status === "fraudulent" || c.status === "flagged").length,
  underInvestigation: claims.filter((c) => c.status === "suspicious" || c.status === "flagged").length,
  confirmedFraud: claims.filter((c) => c.status === "fraudulent").length,
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-600";
    if (score >= 60) return "text-orange-600";
    return "text-green-600";
  };

  const getRiskBgColor = (score: number) => {
    if (score >= 80) return "bg-red-50";
    if (score >= 60) return "bg-orange-50";
    return "bg-green-50";
  };

  const getStatusColor = (status: FraudStatus) => {
    switch (status) {
      case "fraudulent":
        return "bg-red-100 text-red-800";
      case "suspicious":
        return "bg-orange-100 text-orange-800";
      case "flagged":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const toggleSelection = (backendId: number) => {
    setSelectedBackendIds((prev) =>
      prev.includes(backendId) ? prev.filter((id) => id !== backendId) : [...prev, backendId],
    );
  };

  const handleViewFraudTable = () => {
    navigate("/analyst/claims");
  };

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

    fetch(api("/api/claims/upload/"), {
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
        queryClient.invalidateQueries({ queryKey: ["claims"] });
      })
      .catch((error: any) => {
        toast({
          title: "Upload failed",
          description: error.message || "An error occurred while uploading.",
          variant: "destructive",
        });
      });
  };

  const handleDeleteSelected = () => {
    if (!selectedBackendIds.length) return;
    setDeleteIds(selectedBackendIds);
    setDeleteDialogOpen(true);
  };

  const handleAddNote = (claimId: string) => {
    const claim = claims.find((c) => c.id === claimId) || null;
    setSelectedClaim(claim);
    if (claim && accessToken) {
      // Generate a suggested note based on the latest model prediction and rules
      fetch(api("/api/ml/predict-claim-risk/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ claimId: claim.backendId }),
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
    } else {
      setSuggestedNote("");
      setNoteDialogOpen(true);
    }
  };

  const handleMarkFraud = (claimId: string) => {
    setSelectedClaim(claims.find((c) => c.id === claimId) || null);
    setFraudDialogOpen(true);
  };

  const handleGenerateReport = (claimId: string) => {
    setSelectedClaim(claims.find((c) => c.id === claimId) || null);
    setReportDialogOpen(true);
  };

  const submitNote = (note: string) => {
    if (!selectedClaim) return;
    addNoteMutation.mutate({ claimId: selectedClaim.backendId, note });
  };

  const submitFraudStatus = (status: FraudStatus, reason: string) => {
    if (!selectedClaim) return;
    setStatusMutation.mutate({ claimId: selectedClaim.backendId, status, reason });
  };

  const submitReport = (reportType: string) => {
    if (selectedClaim) {
      // Simulate report download
      const reportContent = `
INVESTIGATION REPORT
====================
Claim ID: ${selectedClaim.id}
Provider: ${selectedClaim.provider}
Amount: RWF ${selectedClaim.amount.toLocaleString()}
Risk Score: ${selectedClaim.riskScore}%
Status: ${selectedClaim.status}
Date: ${selectedClaim.date}
Report Type: ${reportType}
Generated: ${new Date().toLocaleString()}

Investigation Notes:
${selectedClaim.investigationNotes.map((note) => `- ${note}`).join("\n")}
      `;
      
      const blob = new Blob([reportContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedClaim.id}-${reportType}-report.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  // Backend integration: load claims for analyst from API
  useQuery({
    queryKey: ["claims"],
    queryFn: async () => {
      const response = await fetch(api("/api/claims/"), {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load claims");
      }

      const data: any[] = await response.json();
      const mapped: ClaimData[] = data.map((claim) => {
        const risk = typeof claim.risk_score === "number" ? claim.risk_score : parseFloat(claim.risk_score || "0");

        let status: FraudStatus = "pending";
        if (claim.review_status === "fraudulent") status = "fraudulent";
        else if (claim.review_status === "legitimate") status = "pending";
        else if (claim.review_status === "investigation") status = "suspicious";

        return {
          id: claim.claim_number,
          backendId: claim.id,
          provider: claim.policy_holder,
          amount: parseFloat(claim.amount),
          riskScore: isNaN(risk) ? 0 : risk,
          status,
          date: new Date(claim.created_at).toLocaleDateString(),
          investigationNotes: claim.notes ? String(claim.notes).split("\n") : [],
        };
      });

      setClaims(mapped);
      return mapped;
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ claimId, note }: { claimId: number; note: string }) => {
      const response = await fetch(api(`/api/claims/${claimId}/add-note/`), {
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
    onSuccess: (updated) => {
      setClaims((prev) =>
        prev.map((c) =>
          c.backendId === updated.id
            ? {
                ...c,
                investigationNotes: updated.notes ? String(updated.notes).split("\n") : [],
              }
            : c,
        ),
      );
      toast({ title: "Note saved", description: "Investigation note added to claim." });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: () => {
      toast({
        title: "Failed to save note",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({
      claimId,
      status,
      reason,
    }: {
      claimId: number;
      status: FraudStatus;
      reason: string;
    }) => {
      let backendStatus: string = "pending";
      if (status === "fraudulent") backendStatus = "fraudulent";
      else if (status === "suspicious" || status === "flagged") backendStatus = "investigation";
      else backendStatus = "legitimate";

      const response = await fetch(
        api(`/api/claims/${claimId}/set-review-status/`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ status: backendStatus, reason }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update claim status");
      }

      return response.json();
    },
    onSuccess: (updated) => {
      setClaims((prev) =>
        prev.map((c) => {
          if (c.backendId !== updated.id) return c;

          let mappedStatus: FraudStatus = "pending";
          if (updated.review_status === "fraudulent") mappedStatus = "fraudulent";
          else if (updated.review_status === "investigation") mappedStatus = "suspicious";
          else if (updated.review_status === "pending") mappedStatus = "pending";

          const notes = updated.notes ? String(updated.notes).split("\n") : c.investigationNotes;

          return {
            ...c,
            status: mappedStatus,
            investigationNotes: notes,
          };
        }),
      );
      toast({ title: "Status updated", description: "Claim review status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: () => {
      toast({
        title: "Failed to update status",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteClaimsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch(api("/api/claims/bulk-delete/"), {
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
      setClaims((prev) => prev.filter((c) => !ids.includes(c.backendId)));
      setSelectedBackendIds([]);
      toast({ title: "Claims deleted", description: "Selected claims have been removed." });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete claims",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!focusVoucher || autoFocusHandled || !claims.length) return;
    const match = claims.find((c) => c.id === focusVoucher);
    if (match) {
      setSelectedClaim(match);
      setNoteDialogOpen(true);
      setAutoFocusHandled(true);
    }
  }, [focusVoucher, autoFocusHandled, claims]);

  return (
    <AppLayout userRole="analyst" userName={userName}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Claims Review Dashboard</h1>
            <p className="text-gray-600 mt-2">Review, analyze, and investigate flagged medical claims</p>
          </div>
          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Claims
          </Button>
        </div>

        {/* Upload batches summary */}
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
                              onClick={handleViewFraudTable}
                            >
                              View
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Claims Uploaded</CardTitle>
          <Upload className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold">{stats.totalClaimsUploaded.toLocaleString()}</div>
          <p className="text-xs text-gray-600 mt-1">Total claims in the system</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High Risk Claims</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold">{stats.highRiskClaims}</div>
          <p className="text-xs text-gray-600 mt-1">Flagged as high risk</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Under Investigation</CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold">{stats.underInvestigation}</div>
          <p className="text-xs text-gray-600 mt-1">Currently being reviewed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Confirmed Fraud</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
          <div className="text-2xl font-bold">{stats.confirmedFraud}</div>
          <p className="text-xs text-gray-600 mt-1">Confirmed fraudulent claims</p>
            </CardContent>
          </Card>
        </div>

        {/* Claims Review Table */}
        {/* <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Pending Claims for Review</CardTitle>
                <CardDescription>High-risk claims requiring investigation</CardDescription>
              </div>
              <div className="flex items-center gap-2">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-10 text-center py-3 px-2"></th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Claim ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Provider</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Risk Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className={`border-b hover:bg-gray-50 ${focusVoucher === claim.id ? "bg-teal-50" : ""}`}
                    >
                      <td className="py-4 px-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={selectedBackendIds.includes(claim.backendId)}
                          onChange={() => toggleSelection(claim.backendId)}
                        />
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900">{claim.id}</td>
                      <td className="py-4 px-4 text-gray-600">{claim.provider}</td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        RWF {claim.amount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getRiskBgColor(claim.riskScore)} ${getRiskColor(claim.riskScore)}`}>
                          <span className={`w-2 h-2 rounded-full ${getRiskColor(claim.riskScore).replace("text-", "bg-")}`}></span>
                          {claim.riskScore}%
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {claim.status !== "pending" && (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(claim.status)}`}>
                            {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button
                            onClick={() => handleAddNote(claim.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Add Note"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMarkFraud(claim.id)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Mark Status"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleGenerateReport(claim.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Generate Report"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteIds([claim.backendId]);
                              setDeleteDialogOpen(true);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Claim"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card> */}

        {/* Investigation Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Trend</CardTitle>
              <CardDescription>Claims processed this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, idx) => (
                  <div key={day}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{day}</span>
                      <span className="text-sm font-semibold text-gray-900">{12 + idx * 2}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-600 h-2 rounded-full"
                        style={{ width: `${((12 + idx * 2) / 20) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decision Summary</CardTitle>
              <CardDescription>This month's claim decisions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-700">Approved</span>
                </div>
                <span className="font-semibold text-gray-900">156 (78%)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-700">Fraudulent</span>
                </div>
                <span className="font-semibold text-gray-900">28 (14%)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm text-gray-700">Under Investigation</span>
                </div>
                <span className="font-semibold text-gray-900">12 (6%)</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm font-semibold text-gray-700">Total Claims</span>
                <span className="font-bold text-lg text-gray-900">196</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <UploadClaimsDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSubmit={handleUploadClaims}
      />

      {selectedClaim && (
        <>
          <InvestigationNoteDialog
            open={noteDialogOpen}
            onOpenChange={setNoteDialogOpen}
            claimId={selectedClaim.id}
            initialNote={suggestedNote}
            onSubmit={submitNote}
          />
          <MarkFraudDialog
            open={fraudDialogOpen}
            onOpenChange={setFraudDialogOpen}
            claimId={selectedClaim.id}
            provider={selectedClaim.provider}
            amount={selectedClaim.amount}
            onSubmit={submitFraudStatus}
          />
          <GenerateReportDialog
            open={reportDialogOpen}
            onOpenChange={setReportDialogOpen}
            claimId={selectedClaim.id}
            onSubmit={submitReport}
          />
        </>
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
