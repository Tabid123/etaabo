import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, LogOut, Save, ShieldCheck, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/hooks/useMerchant";
import { DEFAULT_PAYMENT_LOGOS } from "@/lib/paymentLogos";
import { validateUssdTemplate } from "@/lib/paymentTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DevicesPanel from "@/components/admin/DevicesPanel";
import SmsReadersPanel from "@/components/admin/SmsReadersPanel";
import PaymentSessionsPanel from "@/components/admin/PaymentSessionsPanel";
import FinancialTransactionsPanel from "@/components/admin/FinancialTransactionsPanel";
import { toast } from "sonner";

type MerchantAccess = {
  merchant: Merchant;
  role: string;
  branch_id: string | null;
};

type PaymentProvider = "evc" | "edahab" | "premier";
type ProviderForm = {
  enabled: boolean;
  phone_number: string;
  ussd_template: string;
};

type ProviderSettings = Record<PaymentProvider, ProviderForm>;

const PROVIDERS: Array<{ id: PaymentProvider; label: string; logo: string; order: number }> = [
  { id: "evc", label: "EVC Plus", logo: DEFAULT_PAYMENT_LOGOS.evc, order: 10 },
  { id: "edahab", label: "eDahab", logo: DEFAULT_PAYMENT_LOGOS.edahab, order: 20 },
  { id: "premier", label: "Premier Wallet", logo: DEFAULT_PAYMENT_LOGOS.premier, order: 30 },
];

const emptyProviderSettings = (): ProviderSettings => ({
  evc: { enabled: false, phone_number: "", ussd_template: "" },
  edahab: { enabled: false, phone_number: "", ussd_template: "" },
  premier: { enabled: false, phone_number: "", ussd_template: "" },
});

function MerchantSettingsPanel({ merchant }: { merchant: Merchant }) {
  const [businessName, setBusinessName] = useState(merchant.name);
  const [phoneNumber, setPhoneNumber] = useState(merchant.phone_number);
  const [currency, setCurrency] = useState(merchant.currency || "USD");
  const [payments, setPayments] = useState<ProviderSettings>(emptyProviderSettings());
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBusinessName(merchant.name);
    setPhoneNumber(merchant.phone_number);
    setCurrency(merchant.currency || "USD");

    void supabase
      .from("merchant_payment_methods")
      .select("provider,phone_number,ussd_template,is_active")
      .eq("merchant_id", merchant.id)
      .in("provider", ["evc", "edahab", "premier"])
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Payment settings lama soo qaadi karin", { description: error.message });
          setLoading(false);
          return;
        }
        const next = emptyProviderSettings();
        (data ?? []).forEach((row) => {
          if (row.provider === "evc" || row.provider === "edahab" || row.provider === "premier") {
            next[row.provider] = {
              enabled: row.is_active,
              phone_number: row.phone_number,
              ussd_template: row.ussd_template,
            };
          }
        });
        setPayments(next);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [merchant.id, merchant.name, merchant.phone_number, merchant.currency]);

  const updatePayment = (provider: PaymentProvider, field: keyof ProviderForm, value: string | boolean) => {
    setPayments((current) => ({
      ...current,
      [provider]: { ...current[provider], [field]: value } as ProviderForm,
    }));
  };

  const saveProfile = async () => {
    if (businessName.trim().length < 2) {
      toast.error("Magaca ganacsigu waa inuu lahaadaa ugu yaraan 2 xaraf");
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error("Geli lambarka xiriirka ganacsiga");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("merchants")
      .update({
        name: businessName.trim(),
        phone_number: phoneNumber.trim(),
        currency: currency.trim() || "USD",
        updated_at: new Date().toISOString(),
      })
      .eq("id", merchant.id);
    setSavingProfile(false);
    if (error) {
      toast.error("Xogta ganacsiga lama keydin", { description: error.message });
      return;
    }
    toast.success("Xogta ganacsiga waa la keydiyay");
  };

  const savePayments = async () => {
    const enabled = PROVIDERS.filter((provider) => payments[provider.id].enabled);
    if (enabled.length === 0) {
      toast.error("Ugu yaraan hal payment provider shid");
      return;
    }
    for (const provider of enabled) {
      const config = payments[provider.id];
      if (!config.phone_number.trim() || !config.ussd_template.trim()) {
        toast.error(`${provider.label}: geli receiving number-ka iyo USSD template-ka`);
        return;
      }
      if (!/^\+?\d{6,20}$/.test(config.phone_number.trim())) {
        toast.error(`${provider.label}: receiving number-ku ma saxna`);
        return;
      }
      const templateError = validateUssdTemplate(config.ussd_template);
      if (templateError) {
        toast.error(`${provider.label}: ${templateError}`);
        return;
      }
    }

    setSavingPayments(true);
    try {
      const { data: existing, error: loadError } = await supabase
        .from("merchant_payment_methods")
        .select("id,provider")
        .eq("merchant_id", merchant.id)
        .in("provider", ["evc", "edahab", "premier"]);
      if (loadError) throw loadError;

      for (const provider of PROVIDERS) {
        const config = payments[provider.id];
        const row = existing?.find((item) => item.provider === provider.id);
        if (config.enabled) {
          const payload = {
            merchant_id: merchant.id,
            provider: provider.id,
            label: provider.label,
            phone_number: config.phone_number.trim(),
            ussd_template: config.ussd_template.trim(),
            logo_url: provider.logo,
            is_active: true,
            sort_order: provider.order,
            updated_at: new Date().toISOString(),
          };
          const result = row
            ? await supabase.from("merchant_payment_methods").update(payload).eq("id", row.id)
            : await supabase.from("merchant_payment_methods").insert(payload);
          if (result.error) throw result.error;
        } else if (row) {
          const { error } = await supabase
            .from("merchant_payment_methods")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (error) throw error;
        }
      }
      toast.success("Payment settings waa la keydiyay");
    } catch (error) {
      toast.error("Payment settings lama keydin", {
        description: error instanceof Error ? error.message : "Isku day mar kale.",
      });
    } finally {
      setSavingPayments(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          {merchant.name} — Settings
        </CardTitle>
        <CardDescription>
          Waxaad wax ka beddeli kartaa ganacsigan iyo payment providers-kiisa oo keliya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold">Xogta Ganacsiga</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`business-name-${merchant.id}`}>Magaca</Label>
              <Input
                id={`business-name-${merchant.id}`}
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`business-phone-${merchant.id}`}>Lambarka xiriirka</Label>
              <Input
                id={`business-phone-${merchant.id}`}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                maxLength={32}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`business-currency-${merchant.id}`}>Currency</Label>
              <Input
                id={`business-currency-${merchant.id}`}
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>
          </div>
          <Button onClick={() => void saveProfile()} disabled={savingProfile}>
            {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Keydi xogta
          </Button>
        </div>

        <div className="border-t pt-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Payment Providers</h3>
              <p className="text-xs text-muted-foreground">
                Provider kasta wuxuu leeyahay receiving number iyo USSD template u gaar ah.
              </p>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {PROVIDERS.map((provider) => {
                const config = payments[provider.id];
                return (
                  <div key={provider.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-16 items-center justify-center rounded-lg border bg-white p-2">
                          <img src={provider.logo} alt={provider.label} className="max-h-full max-w-full object-contain" />
                        </div>
                        <div>
                          <p className="font-medium">{provider.label}</p>
                          <p className="text-xs text-muted-foreground">{config.enabled ? "Enabled" : "Disabled"}</p>
                        </div>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => updatePayment(provider.id, "enabled", checked)}
                        aria-label={`Enable ${provider.label}`}
                      />
                    </div>
                    {config.enabled && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-number-${merchant.id}`}>Receiving Number</Label>
                          <Input
                            id={`${provider.id}-number-${merchant.id}`}
                            value={config.phone_number}
                            onChange={(event) => updatePayment(provider.id, "phone_number", event.target.value)}
                            placeholder="61XXXXXXX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${provider.id}-ussd-${merchant.id}`}>USSD Template</Label>
                          <Input
                            id={`${provider.id}-ussd-${merchant.id}`}
                            value={config.ussd_template}
                            onChange={(event) => updatePayment(provider.id, "ussd_template", event.target.value)}
                            placeholder="*712*{phone}*{amount}#"
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground">
                            Ku dar {"{phone}"} iyo {"{amount}"} meesha ay gelayaan.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Button onClick={() => void savePayments()} disabled={loading || savingPayments}>
            {savingPayments ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Keydi payment settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const MerchantDashboard = () => {
  const { user, isAdmin, mustChangePassword, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
    } else if (mustChangePassword) {
      navigate("/set-password", { replace: true });
    } else if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isLoading, user, isAdmin, mustChangePassword, navigate]);

  const { data: access = [], isLoading: accessLoading, error } = useQuery({
    queryKey: ["my-merchant-dashboard", user?.id],
    enabled: Boolean(user && !isLoading && !isAdmin && !mustChangePassword),
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

  if (isLoading || accessLoading || (user && (isAdmin || mustChangePassword))) {
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="space-y-6">
              {merchants.map((merchant) => (
                <MerchantSettingsPanel key={merchant.id} merchant={merchant} />
              ))}
            </div>
            <DevicesPanel merchants={merchants} />
            <SmsReadersPanel merchants={merchants} />
            <PaymentSessionsPanel merchants={merchants} />
            <FinancialTransactionsPanel merchants={merchants} />
          </>
        )}
      </main>
    </div>
  );
};

export default MerchantDashboard;
