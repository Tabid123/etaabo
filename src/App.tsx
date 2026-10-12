import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Pay from "./pages/Pay";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import MerchantDashboard from "./pages/MerchantDashboard";
import SetPassword from "./pages/SetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const ADMIN_HOST = "admin.etaabo.com";
const MERCHANT_HOST = "merchant.etaabo.com";

const HostRedirect = ({ host, targetPath }: { host: string; targetPath?: string }) => {
  useEffect(() => {
    const path = targetPath ??
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`https://${host}${path || "/"}`);
  }, [host, targetPath]);

  return null;
};

const AppRoutes = () => {
  const hostname = window.location.hostname.toLowerCase();
  const isAdminHost = hostname === ADMIN_HOST;
  const isMerchantHost = hostname === MERCHANT_HOST;
  const { user, isAdmin, mustChangePassword, isLoading } = useAuth();

  if (
    isMerchantHost &&
    !isLoading &&
    user &&
    mustChangePassword &&
    window.location.pathname !== "/set-password"
  ) {
    return <Navigate to="/set-password" replace />;
  }

  if (
    isMerchantHost &&
    !isLoading &&
    user &&
    isAdmin &&
    window.location.pathname !== "/" &&
    window.location.pathname !== "/login"
  ) {
    return <Navigate to="/login" replace />;
  }

  if (isAdminHost) {
    return (
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/merchant" element={<HostRedirect host={MERCHANT_HOST} targetPath="/merchant" />} />
        <Route path="/set-password" element={<HostRedirect host={MERCHANT_HOST} targetPath="/set-password" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (isMerchantHost) {
    return (
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/merchant" element={<MerchantDashboard />} />
        <Route path="/admin" element={<HostRedirect host={ADMIN_HOST} targetPath="/admin" />} />
        <Route path="/admin/login" element={<HostRedirect host={ADMIN_HOST} targetPath="/login" />} />
        <Route path="*" element={<Navigate to="/merchant" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/pay" element={<Pay />} />
      <Route path="/admin" element={<HostRedirect host={ADMIN_HOST} targetPath="/admin" />} />
      <Route path="/admin/login" element={<HostRedirect host={ADMIN_HOST} targetPath="/login" />} />
      <Route path="/merchant" element={<HostRedirect host={MERCHANT_HOST} targetPath="/merchant" />} />
      <Route path="/login" element={<HostRedirect host={MERCHANT_HOST} targetPath="/login" />} />
      <Route path="/set-password" element={<HostRedirect host={MERCHANT_HOST} targetPath="/set-password" />} />
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
