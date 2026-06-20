import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Users, Settings, AlertCircle, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const API_BASE_URL = "http://127.0.0.1:8000/api";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  systemHealth: number;
  pendingAlerts: number;
  mlModelsTotal: number;
  mlModelsProduction: number;
}

interface RecentActivity {
  id: number;
  message: string;
  user: string;
  source: string;
  level: "info" | "warning" | "error" | "success";
  timestamp: string;
}

interface PerformanceMetrics {
  cpu: number;
  memory: number;
  database: number;
  disk: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    cpu: 45,
    memory: 62,
    database: 38,
    disk: 71,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userName = sessionStorage.getItem("userName") || "Admin";

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = sessionStorage.getItem("accessToken");
        const response = await fetch(`${API_BASE_URL}/summary/`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        if (!response.ok) {
          console.error("Failed to load dashboard summary", await response.text());
          setError("Failed to load dashboard data.");
          return;
        }

        const data: any = await response.json();

        setStats({
          totalUsers: data.totalUsers ?? 0,
          activeUsers: data.activeUsers ?? 0,
          systemHealth: data.systemHealth ?? 100,
          pendingAlerts: data.pendingAlerts ?? 0,
          mlModelsTotal: data.mlModelsTotal ?? 0,
          mlModelsProduction: data.mlModelsProduction ?? 0,
        });

        if (Array.isArray(data.recentActivities)) {
          setActivities(data.recentActivities as RecentActivity[]);
        }

        if (data.performance) {
          setPerformance({
            cpu: data.performance.cpu ?? 0,
            memory: data.performance.memory ?? 0,
            database: data.performance.database ?? 0,
            disk: data.performance.disk ?? 0,
          });
        }
      } catch (err) {
        console.error("Error loading dashboard summary", err);
        setError("Unexpected error while loading dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();
  }, []);

  return (
    <AppLayout userRole="admin" userName={userName}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor and manage the fraud detection system</p>
          {loading && (
            <p className="text-xs text-gray-500 mt-1">Loading latest data...</p>
          )}
          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
              <p className="text-xs text-gray-600 mt-1">{stats?.activeUsers ?? 0} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.systemHealth ?? 0}%</div>
              <p className="text-xs text-gray-600 mt-1">All systems operational</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingAlerts ?? 0}</div>
              <p className="text-xs text-gray-600 mt-1">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ML Models</CardTitle>
              <Settings className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.mlModelsTotal ?? 0}</div>
              <p className="text-xs text-gray-600 mt-1">{stats?.mlModelsProduction ?? 0} in production</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest system events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-sm text-gray-500">No recent activities yet.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const timeAgo = formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                    });
                    return (
                      <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                          <p className="text-xs text-gray-600">
                            {activity.user} • {timeAgo}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administration tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                👥 Create New User
              </Button>
              <Button variant="outline" className="w-full justify-start">
                ⚙️ Configure System Settings
              </Button>
              <Button variant="outline" className="w-full justify-start">
                📊 View System Logs
              </Button>
              <Button variant="outline" className="w-full justify-start">
                🔄 Trigger System Backup
              </Button>
              <Button variant="outline" className="w-full justify-start">
                🚀 Deploy ML Model
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Performance */}
        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
            <CardDescription>Current system metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                  <span className="text-sm font-semibold text-gray-900">{performance.cpu}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${performance.cpu}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                  <span className="text-sm font-semibold text-gray-900">{performance.memory}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-cyan-600 h-2 rounded-full" style={{ width: `${performance.memory}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Database</span>
                  <span className="text-sm font-semibold text-gray-900">{performance.database}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${performance.database}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Disk Space</span>
                  <span className="text-sm font-semibold text-gray-900">{performance.disk}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${performance.disk}%` }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
