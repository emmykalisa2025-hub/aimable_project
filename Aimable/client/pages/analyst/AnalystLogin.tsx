import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AnalystLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("http://127.0.0.1:8000/api/auth/token/", {
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

      // Verify that this account is actually a Fraud Analyst
      try {
        const profileResponse = await fetch("http://127.0.0.1:8000/api/me/", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.access}`,
          },
        });

        if (!profileResponse.ok) {
          console.error("Failed to load current user profile", await profileResponse.text());
          alert("Unable to verify your role. Please contact an administrator.");
          return;
        }

        const profile: { role?: string; name?: string; email?: string } =
          await profileResponse.json();

        if (profile.role !== "analyst") {
          // Not an analyst: do not allow access to this dashboard
          sessionStorage.removeItem("accessToken");
          sessionStorage.removeItem("refreshToken");
          alert("This login is only for Fraud Analysts.");
          return;
        }

        const resolvedName = profile.name || profile.email || email;
        sessionStorage.setItem("userRole", "analyst");
        sessionStorage.setItem("userName", resolvedName);

        navigate("/analyst/dashboard");
      } catch (profileError) {
        console.error("Error loading current user profile", profileError);
        alert("An error occurred while verifying your role.");
      }
    } catch (error) {
      console.error("Login error", error);
      alert("An error occurred while logging in.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4">
      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl">
            <span className="text-3xl font-bold text-white">RSSB</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Fraud Analyst Login</h1>
          <p className="text-sm text-teal-100">Sign in to access the Fraud Analysis dashboard</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl">🔍</div>
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
            <p className="text-gray-600">Use your analyst account credentials</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username or Email
              </label>
              <Input
                type="text"
                name="username"
                placeholder="analyst or user@example.com"
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

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:shadow-lg transition-shadow h-11 text-white font-semibold"
            >
              Sign In as Fraud Analyst
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
