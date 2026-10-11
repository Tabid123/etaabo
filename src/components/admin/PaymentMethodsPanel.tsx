import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/hooks/useMerchant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DEFAULT_PAYMENT_LOGOS, getPaymentLogo } from "@/lib/paymentLogos";

type PaymentMethodRow = {
  id: string;
  merchant_id: string;
  provider: string;
  label: string;
  phone_number: string;
  ussd_template: string;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
};

const emptyForm = {
  provider: "evc",
  label: "EVC Plus",
  phone_number: "",
  ussd_template: "*712*{phone}*{amount}#",
  logo_url: "",
  is_active: true,
  sort_order: 10,
};

const providerDefaults: Record<string, { label: string; template: string; logo: string }> = {
  evc: { label: "EVC Plus", template: "*712*{phone}*{amount}#", logo: DEFAULT_PAYMENT_LOGOS.evc },
  edahab: { label: "eDahab", template: "*110*{phone}*{amount}#", logo: DEFAULT_PAYMENT_LOGOS.edahab },
  premier: { label: "Premier Wallet", template: "*123*{phone}*{amount}#", logo: DEFAULT_PAYMENT_LOGOS.premier },
  other: { label: "Other", template: "*CODE*{phone}*{amount}#", logo: "" },
};

export default function PaymentMethodsPanel({ merchants }: { merchants: Merchant[] }) {
  const [merchantId, setMerchantId] = useState(merchants[0]?.id ?? "");
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!merchantId && merchants[0]?.id) setMerchantId(merchants[0].id);
  }, [merchantId, merchants]);

  const selectedMerchant = useMemo(
    () => merchants.find((m) => m.id === merchantId),
    [merchantId, merchants]
  );

  const load = async () => {
    if (!merchantId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("merchant_payment_methods")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Payment methods lama soo qaadi karin", { description: error.message });
      return;
    }
    setRows((data ?? []) as PaymentMethodRow[]);
  };

  useEffect(() => {
    void load();
  }, [merchantId]);

  const openCreate = () => {
    setEditing(null);
    const phone = selectedMerchant?.phone_number ?? "";
    const base = selectedMerchant?.ussd_base_code ?? "712";
    setForm({
      ...emptyForm,
      phone_number: phone,
      ussd_template: `*${base}*{phone}*{amount}#`,
      logo_url: DEFAULT_PAYMENT_LOGOS.evc,
    });
    setDialogOpen(true);
  };

  const openEdit = (row: PaymentMethodRow) => {
    setEditing(row);
    setForm({
      provider: row.provider,
      label: row.label,
      phone_number: row.phone_number,
      ussd_template: row.ussd_template,
      logo_url: row.logo_url ?? "",
      is_active: row.is_active,
      sort_order: row.sort_order,
    });
    setDialogOpen(true);
  };

  const handleProviderChange = (provider: string) => {
    const defaults = providerDefaults[provider] ?? providerDefaults.other;
    setForm((prev) => ({
      ...prev,
      provider,
      label: defaults.label,
      ussd_template: defaults.template,
      logo_url: defaults.logo,
    }));
  };

  const save = async () => {
    if (!merchantId || !form.label.trim() || !form.phone_number.trim()) {
      toast.error("Merchant, magaca provider-ka iyo phone number-ka waa required");
      return;
    }
    if (!form.ussd_template.includes("{phone}") || !form.ussd_template.includes("{amount}")) {
      toast.error("USSD template-ku waa inuu leeyahay {phone} iyo {amount}");
      return;
    }

    setSaving(true);
    const payload = {
      merchant_id: merchantId,
      provider: form.provider,
      label: form.label.trim(),
      phone_number: form.phone_number.trim(),
      ussd_template: form.ussd_template.trim(),
      logo_url: form.logo_url.trim() || DEFAULT_PAYMENT_LOGOS[form.provider] || null,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    };

    const { error } = editing
      ? await supabase.from("merchant_payment_methods").update(payload).eq("id", editing.id)
      : await supabase.from("merchant_payment_methods").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Payment method lama keydin", { description: error.message });
      return;
    }

    toast.success(editing ? "Payment method waa la cusbooneysiiyay" : "Payment method waa la daray");
    setDialogOpen(false);
    await load();
  };

  const remove = async (row: PaymentMethodRow) => {
    if (!confirm(`Ma hubtaa inaad tirtirayso ${row.label}?`)) return;
    const { error } = await supabase.from("merchant_payment_methods").delete().eq("id", row.id);
    if (error) {
      toast.error("Payment method lama tirtiri karin", { description: error.message });
      return;
    }
    toast.success("Payment method waa la tirtiray");
    await load();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Merchant kasta u samee EVC, eDahab, Premier ama provider kale oo leh number iyo USSD u gaar ah.
            </CardDescription>
          </div>
          <Button onClick={openCreate} disabled={!merchantId}>
            <Plus className="mr-2 h-4 w-4" />
            Add Method
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label>Merchant</Label>
            <Select value={merchantId} onValueChange={setMerchantId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Dooro merchant" />
              </SelectTrigger>
              <SelectContent>
                {merchants.map((merchant) => (
                  <SelectItem key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Merchant-kan payment method wali ma laha.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-3">
                      {getPaymentLogo(row.provider, row.logo_url) && (
                        <img
                          src={getPaymentLogo(row.provider, row.logo_url) || ""}
                          alt={row.label}
                          className="h-7 w-auto max-w-[120px] object-contain"
                        />
                      )}
                      <p className="font-semibold">{row.label}</p>
                    </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{row.provider.toUpperCase()} • {row.phone_number}</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.ussd_template}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(row)}>
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
            <DialogDescription>
              Template example: *712*{"{phone}"}*{"{amount}"}#
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={handleProviderChange}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evc">EVC Plus</SelectItem>
                  <SelectItem value="edahab">eDahab</SelectItem>
                  <SelectItem value="premier">Premier</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name</Label>
              <Input className="mt-2" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <Label>Payment Number</Label>
              <Input className="mt-2" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div>
              <Label>USSD Template</Label>
              <Input className="mt-2 font-mono" value={form.ussd_template} onChange={(e) => setForm({ ...form, ussd_template: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">Isticmaal {"{phone}"} iyo {"{amount}"} meelaha dynamic-ka ah.</p>
            </div>
            <div>
              <Label>Logo URL (optional)</Label>
              <Input className="mt-2" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">Haddii aad ka tagto default-ka, eTaabo wuxuu isticmaalayaa provider logo-ga default-ka ah.</p>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input className="mt-2" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update Method" : "Save Method"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
