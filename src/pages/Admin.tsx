import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMerchants, type Merchant } from "@/hooks/useMerchant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Shield, LogOut, Plus, Pencil, Trash2, Loader2, Store, Copy, ExternalLink, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DevicesPanel from "@/components/admin/DevicesPanel";
import PaymentSessionsPanel from "@/components/admin/PaymentSessionsPanel";
import FinancialTransactionsPanel from "@/components/admin/FinancialTransactionsPanel";
import { DEFAULT_PAYMENT_LOGOS } from "@/lib/paymentLogos";
import { validateUssdTemplate } from "@/lib/paymentTemplates";

type PaymentProvider = "evc" | "edahab" | "premier";

type PaymentFormState = {
  enabled: boolean;
  phone_number: string;
  ussd_template: string;
};

type PaymentSettings = Record<PaymentProvider, PaymentFormState>;

type MerchantHandoff = {
  merchantName: string;
  merchantId: string;
  adminName: string;
  adminEmail: string;
  adminUrl: string;
  paymentUrl: string;
  accountExists: boolean;
  temporaryPassword: string | null;
  message: string;
};

const generateTemporaryPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
  const maxValidByte = 256 - (256 % alphabet.length);
  let password = "";
  while (password.length < 22) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= maxValidByte) continue;
      password += alphabet[byte % alphabet.length];
      if (password.length === 22) break;
    }
  }
  return password;
};

const PAYMENT_OPTIONS: Array<{
  id: PaymentProvider;
  label: string;
  logo: string;
  sortOrder: number;
}> = [
  { id: "evc", label: "EVC Plus", logo: DEFAULT_PAYMENT_LOGOS.evc, sortOrder: 10 },
  { id: "edahab", label: "eDahab", logo: DEFAULT_PAYMENT_LOGOS.edahab, sortOrder: 20 },
  { id: "premier", label: "Premier Wallet", logo: DEFAULT_PAYMENT_LOGOS.premier, sortOrder: 30 },
];

const emptyPayments = (): PaymentSettings => ({
  evc: { enabled: false, phone_number: "", ussd_template: "" },
  edahab: { enabled: false, phone_number: "", ussd_template: "" },
  premier: { enabled: false, phone_number: "", ussd_template: "" },
});

const getLegacyBaseCode = (template: string) => {
  const match = template.match(/^\*?([^*#]+)\*/);
  return match?.[1] || "712";
};

const Admin = () => {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: merchants = [], isLoading: merchantsLoading } = useMerchants();
  const queryClient = useQueryClient();
  const adminLoginPath = window.location.hostname.toLowerCase() === "admin.etaabo.com" ? "/login" : "/admin/login";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [loadingMerchantPayments, setLoadingMerchantPayments] = useState(false);
  const [formData, setFormData] = useState({
    merchant_id: "",
    name: "",
    logo_url: "",
    banner_url: "",
    currency: "USD",
    is_active: true,
  });
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(emptyPayments());
  const [merchantAdminName, setMerchantAdminName] = useState("");
  const [merchantAdminEmail, setMerchantAdminEmail] = useState("");
  const [merchantHandoff, setMerchantHandoff] = useState<MerchantHandoff | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const { data: merchantAdminIds = [] } = useQuery({
    queryKey: ["merchant-admin-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_memberships")
        .select("merchant_id,role,status")
        .in("role", ["owner", "admin"])
        .eq("status", "active");
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((row) => row.merchant_id)));
    },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  if (!isLoading && (!user || !isAdmin)) {
    navigate(adminLoginPath, { replace: true });
    return null;
  }

  if (isLoading || merchantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      merchant_id: "",
      name: "",
      logo_url: "",
      banner_url: "",
      currency: "USD",
      is_active: true,
    });
    setPaymentSettings(emptyPayments());
    setMerchantAdminName("");
    setMerchantAdminEmail("");
    setEditingMerchant(null);
    setLoadingMerchantPayments(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = async (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      merchant_id: merchant.merchant_id,
      name: merchant.name,
      logo_url: merchant.logo_url || "",
      banner_url: merchant.banner_url || "",
      currency: merchant.currency,
      is_active: merchant.is_active,
    });
    setPaymentSettings(emptyPayments());
    setIsDialogOpen(true);
    setLoadingMerchantPayments(true);

    const { data, error } = await supabase
      .from("merchant_payment_methods")
      .select("provider,phone_number,ussd_template,is_active")
      .eq("merchant_id", merchant.id)
      .in("provider", ["evc", "edahab", "premier"]);

    setLoadingMerchantPayments(false);

    if (error) {
      toast.error("Payments-ka merchant-ka lama soo qaadi karin", { description: error.message });
      return;
    }

    const next = emptyPayments();
    (data || []).forEach((row) => {
      if (row.provider === "evc" || row.provider === "edahab" || row.provider === "premier") {
        next[row.provider] = {
          enabled: row.is_active,
          phone_number: row.phone_number,
          ussd_template: row.ussd_template,
        };
      }
    });
    setPaymentSettings(next);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 5MB" });
      return;
    }
    setIsUploadingBanner(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeId = (formData.merchant_id || "tmp").replace(/[^a-zA-Z0-9_-]/g, "");
      const path = `${safeId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("merchant-banners")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("merchant-banners").getPublicUrl(path);
      setFormData((f) => ({ ...f, banner_url: data.publicUrl }));
      toast.success("Banner uploaded", { description: "Click Save Merchant to persist" });
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message || "Unknown error" });
    } finally {
      setIsUploadingBanner(false);
      e.target.value = "";
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 5MB" });
      return;
    }
    setUploadingField(field);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const safeId = (formData.merchant_id || "tmp").replace(/[^a-zA-Z0-9_-]/g, "");
      const path = `${safeId}-${field}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("merchant-banners")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("merchant-banners").getPublicUrl(path);
      setFormData((f) => ({ ...f, [field]: data.publicUrl }));
      toast.success("Image uploaded", { description: "Click Save Merchant to persist" });
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message || "Unknown error" });
    } finally {
      setUploadingField(null);
      e.target.value = "";
    }
  };

  const setPaymentEnabled = (provider: PaymentProvider, enabled: boolean) => {
    setPaymentSettings((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        enabled,
      },
    }));
  };

  const updatePayment = (
    provider: PaymentProvider,
    field: "phone_number" | "ussd_template",
    value: string
  ) => {
    setPaymentSettings((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        [field]: value,
      },
    }));
  };

  const validatePayments = () => {
    const selected = PAYMENT_OPTIONS.filter((option) => paymentSettings[option.id].enabled);

    if (selected.length === 0) {
      toast.error("Dooro ugu yaraan hal payment method");
      return false;
    }

    for (const option of selected) {
      const payment = paymentSettings[option.id];
      if (!payment.phone_number.trim() || !payment.ussd_template.trim()) {
        toast.error(`${option.label}: geli number-ka iyo USSD code-ka`);
        return false;
      }
      if (!/^\+?\d{6,20}$/.test(payment.phone_number.trim())) {
        toast.error(`${option.label}: lambarka provider-ku ma saxna`);
        return false;
      }
      const templateError = validateUssdTemplate(payment.ussd_template);
      if (templateError) {
        toast.error(`${option.label}: ${templateError}`);
        return false;
      }
    }

    return true;
  };

  const syncPaymentMethods = async (merchantDbId: string) => {
    const { data: existing, error: existingError } = await supabase
      .from("merchant_payment_methods")
      .select("id,provider")
      .eq("merchant_id", merchantDbId)
      .in("provider", ["evc", "edahab", "premier"]);

    if (existingError) throw existingError;

    for (const option of PAYMENT_OPTIONS) {
      const config = paymentSettings[option.id];
      const existingRow = existing?.find((row) => row.provider === option.id);

      if (config.enabled) {
        const payload = {
          merchant_id: merchantDbId,
          provider: option.id,
          label: option.label,
          phone_number: config.phone_number.trim(),
          ussd_template: config.ussd_template.trim(),
          logo_url: option.logo,
          is_active: true,
          sort_order: option.sortOrder,
        };

        if (existingRow) {
          const { error } = await supabase
            .from("merchant_payment_methods")
            .update(payload)
            .eq("id", existingRow.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("merchant_payment_methods")
            .insert(payload);
          if (error) throw error;
        }
      } else if (existingRow) {
        const { error } = await supabase
          .from("merchant_payment_methods")
          .update({ is_active: false })
          .eq("id", existingRow.id);
        if (error) throw error;
      }
    }
  };

  const copyAllDetails = async () => {
    if (!merchantHandoff) return;
    const details = [
      "eTaabo merchant details",
      `Business: ${merchantHandoff.merchantName}`,
      `Merchant ID: ${merchantHandoff.merchantId}`,
      `Admin: ${merchantHandoff.adminName}`,
      `Email: ${merchantHandoff.adminEmail}`,
      `Admin login: ${merchantHandoff.adminUrl}`,
      `Payment page: ${merchantHandoff.paymentUrl}`,
      merchantHandoff.temporaryPassword
        ? `Temporary password: ${merchantHandoff.temporaryPassword}`
        : "Password: Existing account — the password was not changed.",
      merchantHandoff.temporaryPassword
        ? "Change this temporary password immediately after first login."
        : "Use the password already associated with this email.",
      merchantHandoff.message,
    ];
    try {
      await navigator.clipboard.writeText(details.join("\n"));
      toast.success("All details copied");
    } catch {
      toast.error("Copy failed", { description: "Allow clipboard access in the browser." });
    }
  };

  const handleSave = async () => {
    if (!formData.merchant_id.trim() || !formData.name.trim()) {
      toast.error("Merchant ID iyo Business Name waa required");
      return;
    }
    if (!editingMerchant && (!merchantAdminName.trim() || !merchantAdminEmail.trim())) {
      toast.error("Geli magaca iyo email-ka Admin-ka ganacsadaha");
      return;
    }
    if ((merchantAdminEmail.trim() && !merchantAdminName.trim()) || (!merchantAdminEmail.trim() && merchantAdminName.trim())) {
      toast.error("Magaca iyo email-ka Admin-ka labadaba geli, ama labadaba ka tag marka merchant la edit-gareynayo");
      return;
    }
    if (!validatePayments()) return;

    const wasEditing = Boolean(editingMerchant);
    const firstEnabled =
      PAYMENT_OPTIONS.map((option) => ({ option, config: paymentSettings[option.id] }))
        .find(({ config }) => config.enabled);

    if (!firstEnabled) return;

    setIsSaving(true);
    let handoffAfterSave: MerchantHandoff | null = null;

    try {
      const legacyPhone = firstEnabled.config.phone_number.trim();
      const legacyBaseCode = getLegacyBaseCode(firstEnabled.config.ussd_template);

      const payload = {
        merchant_id: formData.merchant_id.trim(),
        name: formData.name.trim(),
        phone_number: legacyPhone,
        logo_url: formData.logo_url || null,
        banner_url: formData.banner_url || null,
        evc_logo_url: DEFAULT_PAYMENT_LOGOS.evc,
        edahab_logo_url: DEFAULT_PAYMENT_LOGOS.edahab,
        premier_logo_url: DEFAULT_PAYMENT_LOGOS.premier,
        ussd_base_code: legacyBaseCode,
        currency: formData.currency,
        is_active: formData.is_active,
      };

      let merchantDbId = editingMerchant?.id;

      if (editingMerchant) {
        const { error } = await supabase
          .from("merchants")
          .update(payload)
          .eq("id", editingMerchant.id);
        if (error) throw error;
      } else {
        const { data: createdMerchant, error } = await supabase
          .from("merchants")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        merchantDbId = createdMerchant.id;
        setEditingMerchant({ id: createdMerchant.id, ...payload } as Merchant);
      }

      if (!merchantDbId) throw new Error("Merchant ID lama helin");

      await syncPaymentMethods(merchantDbId);

      if (merchantAdminEmail.trim()) {
        const generatedPassword = generateTemporaryPassword();
        const { data: invitationData, error: invitationError } = await supabase.functions.invoke(
          "assign-merchant-admin",
          {
            body: {
              merchant_id: merchantDbId,
              full_name: merchantAdminName.trim(),
              email: merchantAdminEmail.trim(),
              initial_password: generatedPassword,
            },
          },
        );

        if (invitationError) {
          throw new Error(`Merchant-ka waa la keydiyay, laakiin Admin account lama diyaarin: ${invitationError.message}`);
        }
        if (invitationData?.error) {
          throw new Error(`Merchant-ka waa la keydiyay, laakiin Admin account lama diyaarin: ${invitationData.error}`);
        }

        handoffAfterSave = {
          merchantName: typeof invitationData?.merchant_name === "string" ? invitationData.merchant_name : formData.name.trim(),
          merchantId: formData.merchant_id.trim(),
          adminName: typeof invitationData?.admin_name === "string" ? invitationData.admin_name : merchantAdminName.trim(),
          adminEmail: typeof invitationData?.email === "string" ? invitationData.email : merchantAdminEmail.trim(),
          adminUrl: typeof invitationData?.admin_url === "string" ? invitationData.admin_url : "https://merchant.etaabo.com/",
          paymentUrl: typeof invitationData?.payment_url === "string" ? invitationData.payment_url : `https://etaabo.com/pay?merchant=${encodeURIComponent(formData.merchant_id.trim())}`,
          accountExists: invitationData?.account_exists === true,
          temporaryPassword: invitationData?.account_created === true ? generatedPassword : null,
          message: typeof invitationData?.message === "string" ? invitationData.message : "Admin account is linked to this business.",
        };
      }

      toast.success(wasEditing ? "Merchant waa la cusbooneysiiyay" : "Merchant waa la sameeyay");
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-admin-status"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-payment-methods"] });
      setIsDialogOpen(false);
      resetForm();
      if (handoffAfterSave) {
        setMerchantHandoff(handoffAfterSave);
        setHandoffOpen(true);
      }
    } catch (error: any) {
      toast.error("Merchant lama keydin", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (merchant: Merchant) => {
    if (!confirm(`Are you sure you want to delete ${merchant.name}?`)) return;

    try {
      const { error } = await supabase.from("merchants").delete().eq("id", merchant.id);
      if (error) throw error;
      toast.success("Merchant deleted");
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
    } catch (error: any) {
      toast.error("Error deleting merchant", { description: error.message });
    }
  };

  const copyPaymentLink = (merchantId: string) => {
    const url = `https://etaabo.com/pay?merchant=${encodeURIComponent(merchantId)}`;
    navigator.clipboard.writeText(url);
    toast.success("Payment link copied!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(adminLoginPath);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">eTaabo Admin</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Dialog
          open={handoffOpen}
          onOpenChange={(open) => {
            setHandoffOpen(open);
            if (!open) setMerchantHandoff(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Merchant Admin Details</DialogTitle>
              <DialogDescription>
                Copy the email, temporary password, admin link and payment page link to send to your customer.
              </DialogDescription>
            </DialogHeader>
            {merchantHandoff && (
              <div className="space-y-4">
                <div className="rounded-xl border p-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Business</span>
                    <span className="text-right font-medium">{merchantHandoff.merchantName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Admin</span>
                    <span className="text-right font-medium">{merchantHandoff.adminName}</span>
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input readOnly value={merchantHandoff.adminEmail} />
                  </div>
                  <div className="space-y-1">
                    <Label>Admin Link</Label>
                    <Input readOnly value={merchantHandoff.adminUrl} />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Page</Label>
                    <Input readOnly value={merchantHandoff.paymentUrl} />
                  </div>
                  <div className="space-y-1">
                    <Label>{merchantHandoff.temporaryPassword ? "Temporary Password" : "Password"}</Label>
                    <Input
                      readOnly
                      type="text"
                      value={merchantHandoff.temporaryPassword ?? "Existing account — password unchanged"}
                      className="font-mono"
                    />
                  </div>
                </div>
                <p className="rounded-lg bg-secondary p-3 text-sm">
                  {merchantHandoff.temporaryPassword
                    ? "Password-kan ku-meelgaarka ah hal mar ayaa la muujinayaa. Admin-ku waa inuu beddelaa marka ugu horreysa ee uu galo."
                    : "Email-kan hore ayuu akoon u lahaa; password-kiisii lama beddelin."}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setHandoffOpen(false)}>Close</Button>
                  <Button onClick={() => void copyAllDetails()}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy All Details
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Merchants
              </CardTitle>
              <CardDescription>
                Dukaan kasta iyo payment methods-kiisa hal meel ka maamul.
              </CardDescription>
            </div>

            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Merchant
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingMerchant ? "Edit Merchant" : "Add New Merchant"}</DialogTitle>
                  <DialogDescription>
                    Xogta dukaanka iyo payments-ka uu isticmaalo halkaan ka maamul.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="merchant_id">Merchant ID *</Label>
                      <Input
                        id="merchant_id"
                        placeholder="shop123"
                        value={formData.merchant_id}
                        onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Business Name *</Label>
                      <Input
                        id="name"
                        placeholder="Mogadishu Market"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold">Admin-ka Ganacsadaha</h3>
                      <p className="text-xs text-muted-foreground">
                        {editingMerchant
                          ? "Ku qor magaca iyo email-ka si aad account ugu xirto ama mid cusub ugu abuurto. Ka tag labadaba maran haddii aadan beddelayn."
                          : "Waxaa ganacsadahan loo samaynayaa Admin u gaar ah. Password ku-meelgaar ah iyo labada link ayaa soo muuqanaya si aad hal mar u wada koobiyeeyso."}
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="merchant_admin_name">Magaca Admin{editingMerchant ? "" : " *"}</Label>
                        <Input
                          id="merchant_admin_name"
                          autoComplete="name"
                          placeholder="Magaca ganacsadaha"
                          value={merchantAdminName}
                          onChange={(e) => setMerchantAdminName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="merchant_admin_email">Email-ka Admin{editingMerchant ? "" : " *"}</Label>
                        <Input
                          id="merchant_admin_email"
                          type="email"
                          autoComplete="email"
                          placeholder="owner@example.com"
                          value={merchantAdminEmail}
                          onChange={(e) => setMerchantAdminEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PIN ama password-ka ganacsadaha ma kaydinayno. Admin-ka cusub wuxuu email-ka ku helayaa link casuumaad ah.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Merchant Logo</Label>
                    <div className="flex items-center gap-4">
                      {formData.logo_url ? (
                        <img
                          src={formData.logo_url}
                          alt="Logo preview"
                          className="w-16 h-16 object-cover rounded-full border border-border"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full border border-dashed flex items-center justify-center">
                          <Store className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, "logo_url")}
                          disabled={uploadingField === "logo_url"}
                        />
                        <Input
                          placeholder="Or paste image URL"
                          value={formData.logo_url}
                          onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="banner_url">Promo Banner</Label>
                    {formData.banner_url && (
                      <img
                        src={formData.banner_url}
                        alt="Banner preview"
                        className="w-full aspect-[16/7] object-cover rounded-lg border border-border"
                      />
                    )}
                    <Input
                      id="banner_file"
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={isUploadingBanner}
                    />
                    <Input
                      id="banner_url"
                      placeholder="Or paste image URL"
                      value={formData.banner_url}
                      onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                    />
                  </div>

                  <div className="rounded-2xl border border-border p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">Payments-ka Dukaanka</h3>
                        <p className="text-xs text-muted-foreground">
                          Dooro payments-ka uu dukaankani isticmaalo. Payment kasta oo aad shiddo wuxuu kuu furayaa number iyo USSD.
                        </p>
                      </div>
                    </div>

                    {loadingMerchantPayments ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {PAYMENT_OPTIONS.map((option) => {
                          const payment = paymentSettings[option.id];

                          return (
                            <div key={option.id} className="rounded-xl border border-border p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-20 h-12 rounded-lg bg-white border flex items-center justify-center p-2">
                                    <img
                                      src={option.logo}
                                      alt={option.label}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  </div>
                                  <div>
                                    <p className="font-semibold">{option.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {payment.enabled ? "Enabled" : "Disabled"}
                                    </p>
                                  </div>
                                </div>
                                <Switch
                                  checked={payment.enabled}
                                  onCheckedChange={(checked) => setPaymentEnabled(option.id, checked)}
                                />
                              </div>

                              {payment.enabled && (
                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>{option.label} Number *</Label>
                                    <Input
                                      placeholder="61XXXXXXX"
                                      value={payment.phone_number}
                                      onChange={(e) => updatePayment(option.id, "phone_number", e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>USSD Code / Template *</Label>
                                    <Input
                                      className="font-mono"
                                      placeholder="*712*{phone}*{amount}#"
                                      value={payment.ussd_template}
                                      onChange={(e) => updatePayment(option.id, "ussd_template", e.target.value)}
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                      Isticmaal {"{phone}"} iyo {"{amount}"} halka number-ka iyo lacagtu geli doonaan.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div>
                      <Label htmlFor="is_active">Merchant Active</Label>
                      <p className="text-xs text-muted-foreground">Haddii la damiyo, payment page-ku ma shaqeynayo.</p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSave}
                    disabled={isSaving || isUploadingBanner || loadingMerchantPayments}
                  >
                    {isSaving || isUploadingBanner ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : editingMerchant ? (
                      "Save Merchant"
                    ) : (
                      "Create Merchant"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            {merchants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No merchants yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Create your first merchant to start accepting payments</p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Merchant
                </Button>
              </div>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {merchants.map((merchant) => (
                    <div key={merchant.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                          {merchant.logo_url ? (
                            <img src={merchant.logo_url} alt={merchant.name} className="w-full h-full object-cover" />
                          ) : (
                            <Store className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{merchant.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{merchant.merchant_id}</p>
                              <p className={`text-xs mt-1 ${merchantAdminIds.includes(merchant.id) ? "text-emerald-600" : "text-amber-600"}`}>
                                {merchantAdminIds.includes(merchant.id) ? "Admin assigned" : "Admin not assigned"}
                              </p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${merchant.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {merchant.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
                        <Button variant="ghost" size="icon" onClick={() => copyPaymentLink(merchant.merchant_id)} title="Copy payment link">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`https://etaabo.com/pay?merchant=${encodeURIComponent(merchant.merchant_id)}`, "_blank")}
                          title="Preview"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void openEditDialog(merchant)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(merchant)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Merchant Admin</TableHead>
                        <TableHead>Payment Link</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {merchants.map((merchant) => (
                        <TableRow key={merchant.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                                {merchant.logo_url ? (
                                  <img src={merchant.logo_url} alt={merchant.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Store className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{merchant.name}</p>
                                <p className="text-xs text-muted-foreground">{merchant.merchant_id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${merchant.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {merchant.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${merchantAdminIds.includes(merchant.id) ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                              {merchantAdminIds.includes(merchant.id) ? "Assigned" : "Missing"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            etaabo.com/pay?merchant={merchant.merchant_id}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => copyPaymentLink(merchant.merchant_id)} title="Copy payment link">
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(`https://etaabo.com/pay?merchant=${encodeURIComponent(merchant.merchant_id)}`, "_blank")}
                                title="Preview payment page"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => void openEditDialog(merchant)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(merchant)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 space-y-8">
          <DevicesPanel merchants={merchants} />
          <PaymentSessionsPanel merchants={merchants} />
          <FinancialTransactionsPanel merchants={merchants} />
        </div>
      </main>
    </div>
  );
};

export default Admin;
