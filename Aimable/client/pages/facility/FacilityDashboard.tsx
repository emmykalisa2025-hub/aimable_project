import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, FileText, AlertCircle } from "lucide-react";

interface ClaimRecord {
  id: string;
  date: string;
  amount: number;
  status: "approved" | "pending" | "rejected";
  description: string;
}

export default function FacilityDashboard() {
  const userName = sessionStorage.getItem("userName") || "Facility";

  const stats = {
    submitted: 24,
    approved: 20,
    pending: 3,
    rejected: 1,
  };

  const claims: ClaimRecord[] = [
    {
      id: "CLM-2024-001",
      date: "2024-01-15",
      amount: 2500,
      status: "approved",
      description: "Emergency surgery services",
    },
    {
      id: "CLM-2024-002",
      date: "2024-01-14",
      amount: 1200,
      status: "pending",
      description: "Outpatient consultation",
    },
    {
      id: "CLM-2024-003",
      date: "2024-01-13",
      amount: 3400,
      status: "pending",
      description: "Hospitalization (5 days)",
    },
    {
      id: "CLM-2024-004",
      date: "2024-01-12",
      amount: 800,
      status: "approved",
      description: "Laboratory tests",
    },
  ];

  const getStatusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-orange-600" />;
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusColor = (status: string) => {
    if (status === "approved") return "bg-green-100 text-green-800";
    if (status === "pending") return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <AppLayout userRole="facility" userName={userName}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Facility Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Submit and track medical claims with RSSB
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submitted</CardTitle>
              <FileText className="h-4 w-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.submitted}</div>
              <p className="text-xs text-gray-600 mt-1">All claims</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-gray-600 mt-1">{Math.round((stats.approved / stats.submitted) * 100)}% success rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-gray-600 mt-1">Under review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-gray-600 mt-1">Need clarification</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button className="bg-cyan-600 hover:bg-cyan-700 h-12 text-base">
            + Submit New Claim
          </Button>
          <Button variant="outline" className="h-12 text-base">
            View Documentation
          </Button>
          <Button variant="outline" className="h-12 text-base">
            Contact Support
          </Button>
        </div>

        {/* Claim History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Claim History</CardTitle>
                <CardDescription>Your recent claim submissions and status</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                Export All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Claim ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4 font-medium text-gray-900">{claim.id}</td>
                      <td className="py-4 px-4 text-gray-600">{claim.description}</td>
                      <td className="py-4 px-4 text-gray-600">
                        {new Date(claim.date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        RWF {claim.amount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusIcon(claim.status)}
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(claim.status)}`}>
                            {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
                            Details
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

        {/* Summary & Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
              <CardDescription>Claims value overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Total Approved</p>
                  <p className="text-2xl font-bold text-gray-900">RWF 98,500</p>
                </div>
                <span className="text-3xl">✓</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Pending Review</p>
                  <p className="text-2xl font-bold text-gray-900">RWF 4,600</p>
                </div>
                <span className="text-3xl">⏳</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-gray-900">RWF 800</p>
                </div>
                <span className="text-3xl">✗</span>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Submit Claims</CardTitle>
              <CardDescription>Quick guide for claim submission</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { step: 1, title: "Gather Documents", desc: "Collect all required medical records" },
                { step: 2, title: "Fill Out Form", desc: "Complete the claim submission form" },
                { step: 3, title: "Upload Files", desc: "Attach supporting documentation" },
                { step: 4, title: "Submit", desc: "Review and submit your claim" },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-cyan-600 text-white rounded-full flex items-center justify-center font-semibold">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
