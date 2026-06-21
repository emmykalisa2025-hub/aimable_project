import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useMemo } from "react";
import { Search, Download, AlertCircle, CheckCircle, Info, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/config";

type LogLevel = "info" | "warning" | "error" | "success";

interface SystemLog {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
  userId?: string;
}

// use api() helper for backend endpoints

// Mock log data
const mockLogs: SystemLog[] = [
  {
    id: 101,
    timestamp: "2024-03-01 14:35:22",
    level: "success",
    source: "User Management",
    message: "New user created successfully",
    details: "User: Dr. James Smith (james.smith@rssb.rw) | Role: System Administrator",
    userId: "admin@rssb.rw",
  },
  {
    id: 102,
    timestamp: "2024-03-01 14:32:15",
    level: "info",
    source: "System",
    message: "Database backup initiated",
    details: "Full backup of production database started",
    userId: "system",
  },
  {
    id: 103,
    timestamp: "2024-03-01 14:28:45",
    level: "warning",
    source: "ML Models",
    message: "Model accuracy below threshold",
    details: "Model ID: 4 | Current Accuracy: 84.5% | Threshold: 85%",
    userId: "scientist@rssb.rw",
  },
  {
    id: 104,
    timestamp: "2024-03-01 14:25:30",
    level: "error",
    source: "API Integration",
    message: "Failed to connect to external service",
    details: "Service: Payment Gateway | Status Code: 503 | Retry: 3 of 5",
    userId: "system",
  },
  {
    id: 105,
    timestamp: "2024-03-01 14:20:10",
    level: "success",
    source: "User Management",
    message: "User role updated",
    details: "User: Sarah Johnson | Old Role: Analyst | New Role: Senior Analyst",
    userId: "admin@rssb.rw",
  },
  {
    id: 106,
    timestamp: "2024-03-01 14:15:45",
    level: "info",
    source: "Claims Processing",
    message: "Daily claims processing completed",
    details: "Total Claims: 245 | Approved: 198 | Rejected: 47",
    userId: "system",
  },
  {
    id: 107,
    timestamp: "2024-03-01 14:10:22",
    level: "warning",
    source: "System",
    message: "High memory usage detected",
    details: "Current Usage: 78% | Threshold: 75% | Action: Monitoring",
    userId: "system",
  },
  {
    id: 108,
    timestamp: "2024-03-01 14:05:33",
    level: "success",
    source: "ML Models",
    message: "Model training completed",
    details: "Model: Fraud Detection v2.1 | Epochs: 100 | F1-Score: 0.92",
    userId: "scientist@rssb.rw",
  },
  {
    id: 109,
    timestamp: "2024-03-01 14:00:11",
    level: "error",
    source: "Database",
    message: "Connection pool exhausted",
    details: "Max Connections: 100 | Active: 100 | Pending: 12",
    userId: "system",
  },
  {
    id: 110,
    timestamp: "2024-03-01 13:55:42",
    level: "info",
    source: "Security",
    message: "User login attempt - successful",
    details: "User: Pierre Nkomo | IP: 192.168.1.100 | Location: Kigali",
    userId: "pierre.nkomo@rssb.rw",
  },
  {
    id: 111,
    timestamp: "2024-03-01 13:50:15",
    level: "warning",
    source: "System Settings",
    message: "Configuration mismatch detected",
    details: "Component: Email Service | Expected: Gmail | Found: SMTP",
    userId: "admin@rssb.rw",
  },
  {
    id: 112,
    timestamp: "2024-03-01 13:45:58",
    level: "success",
    source: "Reports",
    message: "Monthly report generated",
    details: "Report: Fraud Analysis | Format: PDF | Size: 2.4 MB",
    userId: "analyst@rssb.rw",
  },
];

const logLevelColors: Record<LogLevel, { bg: string; text: string; icon: React.ReactNode }> = {
  error: {
    bg: "bg-red-100",
    text: "text-red-800",
    icon: <AlertCircle className="w-4 h-4" />,
  },
  warning: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  info: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    icon: <Info className="w-4 h-4" />,
  },
  success: {
    bg: "bg-green-100",
    text: "text-green-800",
    icon: <CheckCircle className="w-4 h-4" />,
  },
};

const defaultSources = [
  "All Sources",
  "User Management",
  "System",
  "ML Models",
  "API Integration",
  "Claims Processing",
  "Database",
  "Security",
  "System Settings",
  "Reports",
];

export default function SystemLogs() {
  const userName = sessionStorage.getItem("userName") || "Admin";
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | "all">("all");
  const [selectedSource, setSelectedSource] = useState("All Sources");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = sessionStorage.getItem("accessToken");
        const response = await fetch(api("/admin/system-logs/"), {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        if (!response.ok) {
          console.error("Failed to load system logs", await response.text());
          setError("Failed to load system logs.");
          return;
        }

        const data: SystemLog[] = await response.json();
        setLogs(data);
      } catch (err) {
        console.error("Error loading system logs", err);
        setError("Unexpected error while loading system logs.");
      } finally {
        setLoading(false);
      }
    };

    void fetchLogs();
  }, []);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userId?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;

      const matchesSource =
        selectedSource === "All Sources" || log.source === selectedSource;

      return matchesSearch && matchesLevel && matchesSource;
    });
  }, [logs, searchTerm, selectedLevel, selectedSource]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleExportLogs = () => {
    const csv = [
      ["Timestamp", "Level", "Source", "Message", "User ID"],
      ...filteredLogs.map((log) => [
        log.timestamp,
        log.level,
        log.source,
        log.message,
        log.userId || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AppLayout userRole="admin" userName={userName}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
            <p className="text-gray-600 mt-2">Monitor and analyze system activities</p>
          </div>
          <Button
            onClick={handleExportLogs}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Logs
          </Button>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find and filter system logs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by message, source, or user..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Log Level Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log Level
                </label>
                <select
                  value={selectedLevel}
                  onChange={(e) => {
                    setSelectedLevel(e.target.value as LogLevel | "all");
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="all">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source
                </label>
                <select
                  value={selectedSource}
                  onChange={(e) => {
                    setSelectedSource(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  {Array.from(new Set([...defaultSources, ...logs.map((log) => log.source)])).map(
                    (source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {/* Items Per Page */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Logs per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Results Info */}
            <div className="text-sm text-gray-600">
              Showing {filteredLogs.length === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
            <CardDescription>{filteredLogs.length} logs found</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading logs...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            ) : paginatedLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No logs found matching your filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    {/* Log Header */}
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 p-2 rounded-lg ${logLevelColors[log.level].bg}`}>
                        <div className={logLevelColors[log.level].text}>
                          {logLevelColors[log.level].icon}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${logLevelColors[log.level].bg} ${logLevelColors[log.level].text}`}>
                            {log.level.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-600">{log.timestamp}</span>
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {log.source}
                          </span>
                          {log.userId && (
                            <span className="text-xs text-gray-600">by {log.userId}</span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-gray-900 mt-2">{log.message}</p>

                        {/* Expandable Details */}
                        {log.details && (
                          <>
                            {expandedLogId === log.id && (
                              <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                                <p className="text-sm text-gray-700 font-mono">{log.details}</p>
                              </div>
                            )}
                            <button
                              onClick={() =>
                                setExpandedLogId(
                                  expandedLogId === log.id ? null : log.id
                                )
                              }
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                            >
                              {expandedLogId === log.id ? "Hide" : "Show"} Details
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
