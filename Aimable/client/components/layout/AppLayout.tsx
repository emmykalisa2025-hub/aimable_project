import { Link, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
  userRole?: "admin" | "analyst" | "scientist" | "facility" | null;
  userName?: string;
}

const roleColors: Record<string, { sidebar: string; accent: string }> = {
  admin: { sidebar: "bg-blue-900", accent: "bg-blue-600" },
  analyst: { sidebar: "bg-teal-900", accent: "bg-teal-600" },
  scientist: { sidebar: "bg-indigo-900", accent: "bg-indigo-600" },
  facility: { sidebar: "bg-cyan-900", accent: "bg-cyan-600" },
};

const roleNames: Record<string, string> = {
  admin: "System Administrator",
  analyst: "Fraud Analyst",
  scientist: "Data Scientist",
  facility: "Health Facility",
};

const roleNavigation: Record<string, Array<{ label: string; path: string; icon: string }>> = {
  admin: [
    { label: "Dashboard", path: "/admin/dashboard", icon: "📊" },
    { label: "User Management", path: "/admin/users", icon: "👥" },
    { label: "System Settings", path: "/admin/settings", icon: "⚙️" },
    { label: "System Logs", path: "/admin/logs", icon: "📋" },
  ],
  analyst: [
    { label: "Dashboard", path: "/analyst/dashboard", icon: "📊" },
    { label: "Claims Review", path: "/analyst/claims", icon: "📝" },
    { label: "Investigation Reports", path: "/analyst/reports", icon: "📑" },
  ],
  scientist: [
    { label: "Dashboard", path: "/scientist/dashboard", icon: "📊" },
    { label: "Model Training", path: "/scientist/training", icon: "🧠" },
    { label: "Model Evaluation", path: "/scientist/evaluation", icon: "📈" },
    { label: "Deploy Model", path: "/scientist/deploy", icon: "🚀" },
  ],
  facility: [
    { label: "Dashboard", path: "/facility/dashboard", icon: "📊" },
    { label: "Submit Claim", path: "/facility/submit", icon: "📤" },
    { label: "My Claims", path: "/facility/claims", icon: "📋" },
  ],
};

export function AppLayout({ children, userRole, userName }: AppLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      const accessToken = sessionStorage.getItem("accessToken");
      const refreshToken = sessionStorage.getItem("refreshToken");

      if (refreshToken) {
        await fetch("http://127.0.0.1:8000/api/auth/logout/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: accessToken ? `Bearer ${accessToken}` : "",
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      }
    } catch (error) {
      console.error("Error during logout", error);
    } finally {
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
      sessionStorage.removeItem("userRole");
      sessionStorage.removeItem("userName");
      navigate("/login");
    }
  };

  if (!userRole) {
    return <>{children}</>;
  }

  const colors = roleColors[userRole];
  const navItems = roleNavigation[userRole];
  const roleName = roleNames[userRole];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${colors.sidebar} text-white w-64 transition-all duration-300 flex flex-col ${!sidebarOpen ? "w-20" : ""}`}>
        {/* Logo Area */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center font-bold">
              RSSB
            </div>
            {sidebarOpen && <div className="font-semibold">RSSB FD</div>}
          </div>
        </div>

        {/* Role Info */}
        {sidebarOpen && (
          <div className="px-6 py-4 bg-white/5">
            <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Role</p>
            <p className="text-sm font-semibold">{roleName}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                sidebarOpen ? "" : "justify-center"
              } hover:bg-white/10`}
              title={!sidebarOpen ? item.label : ""}
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
            title={!sidebarOpen ? "Toggle Sidebar" : ""}
          >
            <Menu className="w-4 h-4" />
            {sidebarOpen && <span className="text-sm">Toggle</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
            title={!sidebarOpen ? "Logout" : ""}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{roleName}</h2>
          {userName && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{userName}</p>
                <p className="text-xs text-gray-600">{roleName}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
