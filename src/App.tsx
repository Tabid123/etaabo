import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Pay from "./pages/Pay";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import MerchantDashboard from "./pages/MerchantDashboard";
import SetPassword from "./pages/SetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const ADMIN_HOST = "admin.etaabo.com";

const AdminDomainRedirect = () => {
  useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`https://${ADMIN_HOST}${currentPath || "/"}`);
  }, []);

  return null;
};

const AppRoutes = () => {
  const isAdminHost = window.location.hostname.toLowerCase() === ADMIN_HOST;

  if (isAdminHost) {
    return (
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/merchant" element={<MerchantDashboard />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/pay" element={<Pay />} />
      <Route path="/admin" element={<AdminDomainRedirect />} />
      <Route path="/admin/login" element={<AdminDomainRedirect />} />
      <Route path="/merchant" element={<AdminDomainRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
