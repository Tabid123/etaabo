import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LogOut, Store, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/hooks/useMerchant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PaymentSessionsPanel from "@/components/admin/PaymentSessionsPanel";
import FinancialTransactionsPanel from "@/components/admin/FinancialTransactionsPanel";

type MerchantAccess = {
  merchant: Merchant;
  role: string;
  branch_id: string | null;
};

const MerchantDashboard = () => {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
    } else if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isLoading, user, isAdmin, navigate]);

  const { data: access = [], isLoading: accessLoading, error } = useQuery({
    queryKey: ["my-merchant-dashboard", user?.id],
    enabled: Boolean(user && !isLoading && !isAdmin),
    queryFn: async (): Promise<MerchantAccess[]> => {
      if (!user) return [];
      const { data: memberships, error: membershipError } = await supabase
        .from("merchant_memberships")
        .select("merchant_id,role,branch_id,status")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (membershipError) throw membershipError;

      const managers = (memberships ?? []).filter((membership) =>
        membership.role === "owner" || membership.role === "admin"
      );
      if (managers.length === 0) return [];

      const merchantIds = Array.from(new Set(managers.map((membership) => membership.merchant_id)));
      const { data: merchantRows, error: merchantError } = await supabase
        .from("merchants")
        .select("*")
        .in("id", merchantIds);

      if (merchantError) throw merchantError;

      return managers.flatMap((membership) => {
        const merchant = (merchantRows ?? []).find((row) => row.id === membership.merchant_id);
        return merchant ? [{ merchant: merchant as Merchant, role: membership.role, branch_id: membership.branch_id }] : [];
      });
    },
  });

  const merchants = useMemo(() => {
    const byId = new Map<string, Merchant>();
    access.forEach((item) => byId.set(item.merchant.id, item.merchant));
    return Array.from(byId.values());
  }, [access]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (isLoading || accessLoading || (user && isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">eTaabo Merchant Admin</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-4 py-8">
        {error ? (
          <Card>
            <CardHeader>
              <CardTitle>Ganacsiga lama soo qaadi karin</CardTitle>
              <CardDescription>{error instanceof Error ? error.message : "Fadlan isku day mar kale."}</CardDescription>
            </CardHeader>
          </Card>
        ) : merchants.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Admin access wali lama helin</CardTitle>
              <CardDescription>
                Email-kan lama xiriirin ganacsi leh owner/admin access. Ka codso eTaabo Super Admin inuu kuu diro casuumaad sax ah.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold">Ganacsiyadayda</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Waxaad arki kartaa oo maamuli kartaa ganacsiyada laguugu xiro oo keliya.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {merchants.map((merchant) => {
                const membership = access.find((item) => item.merchant.id === merchant.id);
                return (
                  <Card key={merchant.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                          {merchant.logo_url ? (
                            <img src={merchant.logo_url} alt={merchant.name} className="h-full w-full object-cover" />
                          ) : (
                            <Store className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate">{merchant.name}</CardTitle>
                          <CardDescription>{merchant.merchant_id}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Role</span>
                        <span className="font-medium">{membership?.role === "owner" ? "Owner / Admin" : "Admin"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className={merchant.is_active ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
                          {merchant.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="pt-2 text-xs text-muted-foreground">
                        Payment links and transaction records remain scoped to your assigned merchant access.
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <PaymentSessionsPanel merchants={merchants} />
            <FinancialTransactionsPanel merchants={merchants} />
          </>
        )}
      </main>
    </div>
  );
};

export default MerchantDashboard;
