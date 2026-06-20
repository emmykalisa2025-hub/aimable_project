import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot, Root } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import SystemLogs from "./pages/admin/SystemLogs";
import AnalystDashboard from "./pages/analyst/AnalystDashboard";
import AnalystLogin from "./pages/analyst/AnalystLogin";
import ClaimsReview from "./pages/analyst/ClaimsReview";
import ScientistDashboard from "./pages/scientist/ScientistDashboard";
import FacilityDashboard from "./pages/facility/FacilityDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/analyst/login" element={<AnalystLogin />} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/logs" element={<SystemLogs />} />

          {/* Analyst Routes */}
          <Route path="/analyst/dashboard" element={<AnalystDashboard />} />
          <Route path="/analyst/claims" element={<ClaimsReview />} />

          {/* Data Scientist Routes */}
          <Route path="/scientist/dashboard" element={<ScientistDashboard />} />

          {/* Health Facility Routes */}
          <Route path="/facility/dashboard" element={<FacilityDashboard />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Initialize React root once and reuse it for HMR updates
function initializeApp() {
  const container = document.getElementById("root");

  if (!container) return;

  // Check if root already exists to prevent duplicate createRoot calls
  if (!(window as any).__reactRoot) {
    (window as any).__reactRoot = createRoot(container);
  }

  const root = (window as any).__reactRoot as Root;
  root.render(<App />);
}

// Initialize on first load and HMR updates
if (import.meta.hot) {
  // Development mode with HMR
  import.meta.hot.dispose(() => {
    // Cleanup on HMR
  });
  import.meta.hot.accept(() => {
    // Re-render on HMR without creating new root
    initializeApp();
  });
}

initializeApp();
