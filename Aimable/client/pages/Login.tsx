import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/config";

type UserRole = "admin" | "analyst" | "scientist" | "facility";

interface RoleOption {
  id: UserRole;
  name: string;
  icon: string;
  color: string;
}

const roles: RoleOption[] = [
  {
    id: "admin",
    name: "System Administrator",
    icon: "🔐",
    color: "from-blue-600 to-blue-700",
  },
  {
    id: "analyst",
    name: "Fraud Analyst",
    icon: "🔍",
    color: "from-teal-600 to-teal-700",
  },
  {
    id: "scientist",
    name: "Data Scientist",
    icon: "🧠",
    color: "from-indigo-600 to-indigo-700",
  },
  {
    id: "facility",
    name: "Health Facility",
    icon: "🏥",
    color: "from-cyan-600 to-cyan-700",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(api("/api/auth/token/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: email,
          password,
        }),
      });

      if (!response.ok) {
        alert("Login failed. Please check your credentials.");
        return;
      }

      const data = await response.json();

      // Store tokens first
      sessionStorage.setItem("accessToken", data.access);
      sessionStorage.setItem("refreshToken", data.refresh);

      // Fetch current user profile to determine actual role
      let resolvedRole: UserRole = "admin";
      let resolvedName: string | null = null;

      try {
        const profileResponse = await fetch(api("/api/me/"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.access}`,
          },
        });

        if (profileResponse.ok) {
          const profile: { role?: string; name?: string; username?: string; email?: string } =
            await profileResponse.json();

          if (
            profile.role === "admin" ||
            profile.role === "analyst" ||
            profile.role === "scientist" ||
            profile.role === "facility"
          ) {
            resolvedRole = profile.role;
          }

          resolvedName = profile.name || profile.username || profile.email || null;
        } else {
          console.error("Failed to load current user profile", await profileResponse.text());
        }
      } catch (profileError) {
        console.error("Error loading current user profile", profileError);
      }

      sessionStorage.setItem("userRole", resolvedRole);
      sessionStorage.setItem(
        "userName",
        resolvedName || email.split("@")[0] || email,
      );

      const dashboardPaths: Record<UserRole, string> = {
        admin: "/admin/dashboard",
        analyst: "/analyst/dashboard",
        scientist: "/scientist/dashboard",
        facility: "/facility/dashboard",
      };

      navigate(dashboardPaths[resolvedRole]);
    } catch (error) {
      console.error("Login error", error);
      alert("An error occurred while logging in.");
    }
  };

  const selectedRoleData = roles.find((r) => r.id === selectedRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl">
            <span className="text-3xl font-bold text-white">RSSB</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Fraud Detection System
          </h1>
          <p className="text-sm text-blue-100">
            Rwanda Social Security Board
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl">{selectedRoleData?.icon}</div>
            <h2 className="text-2xl font-bold text-gray-900">
              Sign In
            </h2>
            <p className="text-gray-600">Access your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username or Email
              </label>
              <Input
                type="text"
                name="username"
                placeholder="admin or user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Role
              </label>
              <select
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.icon} {role.name}
                  </option>
                ))}
              </select>
            </div> */}

            <Button
              type="submit"
              className={`w-full bg-gradient-to-r ${selectedRoleData?.color} hover:shadow-lg transition-shadow h-11 text-white font-semibold`}
            >
              Sign In
            </Button>
          </form>

          {/* Demo info */}
          <div className="pt-4 border-t text-center text-sm text-gray-600">
            <p>Demo mode: Use any username or email and password</p>
          </div>
        </div>
      </div>

      {/* Blob animations styles */}
      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
