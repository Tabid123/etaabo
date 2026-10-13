import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Plus, RefreshCw, Smartphone, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/hooks/useMerchant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type BranchRow = { id: string; merchant_id: string; name: string; is_active: boolean };
type SmsReaderRow = {
  id: string; merchant_id: string; branch_id: string | null; label: string; status: string;
  last_sync_at: string | null; last_seen_at: string | null; device_model: string | null;
  device_manufacturer: string | null; android_version: string | null; app_version: string | null;
  sim_last4: string | null; paired_at: string | null; revoked_at: string | null; created_at: string;
};
type PairingResult = { reader_id: string; label: string; pairing_code: string; expires_at: string; instructions: string };

const readableStatus = (status: string) => {
  if (status === "paired") return "Paired";
  if (status === "pending") return "Pending pairing";
  if (status === "revoked") return "Revoked";
  return status;
};

const lastSeenLabel = (reader: SmsReaderRow) => {
  if (!reader.last_seen_at) return "Weli server-ku ma arag";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(reader.last_seen_at).getTime()) / 1000));
  if (seconds < 90) return "Online hadda";
  if (seconds < 3600) return seconds + " daqiiqo ka hor";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " saac ka hor";
  return new Date(reader.last_seen_at).toLocaleString();
};

export default function SmsReadersPanel({ merchants }: { merchants: Merchant[] }) {
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState(merchants[0]?.id ?? "");
  const [branchId, setBranchId] = useState("none");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null);
  const [pairingDialogOpen, setPairingDialogOpen] = useState(false);

  useEffect(() => {
    if (!merchantId && merchants.length > 0) setMerchantId(merchants[0].id);
    if (merchantId && !merchants.some((merchant) => merchant.id === merchantId)) setMerchantId(merchants[0]?.id ?? "");
  }, [merchants, merchantId]);
  useEffect(() => { setBranchId("none"); }, [merchantId]);

  const merchantIds = useMemo(() => Array.from(new Set(merchants.map((merchant) => merchant.id))), [merchants]);

  const { data: branches = [] } = useQuery({
    queryKey: ["sms-reader-branches", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async (): Promise<BranchRow[]> => {
      const { data, error } = await supabase.from("branches").select("id,merchant_id,name,is_active")
        .in("merchant_id", merchantIds).eq("is_active", true).order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BranchRow[];
    },
  });

  const visibleBranches = useMemo(() => branches.filter((branch) => branch.merchant_id === merchantId), [branches, merchantId]);

  const { data: readers = [], isLoading, error } = useQuery({
    queryKey: ["sms-readers", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async (): Promise<SmsReaderRow[]> => {
      const { data, error } = await supabase.from("sms_readers")
        .select("id,merchant_id,branch_id,label,status,last_sync_at,last_seen_at,device_model,device_manufacturer,android_version,app_version,sim_last4,paired_at,revoked_at,created_at")
        .in("merchant_id", merchantIds).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as SmsReaderRow[];
    },
    refetchInterval: 15000,
  });

  const handleCreatePairing = async () => {
    if (!merchantId) { toast.error("Dooro ganacsadaha SMS Reader-kan leh"); return; }
    if (label.trim().length < 2) { toast.error("Geli magaca telefoonka, tusaale: Shop Android 01"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-sms-reader-pairing", {
        body: { merchant_id: merchantId, branch_id: branchId === "none" ? null : branchId, label: label.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.pairing_code || !data?.reader_id) throw new Error("Pairing code lama helin");
      setPairingResult(data as PairingResult);
      setPairingDialogOpen(true);
      setLabel("");
      await queryClient.invalidateQueries({ queryKey: ["sms-readers", merchantIds] });
    } catch (error) {
      toast.error("SMS Reader pairing code lama samayn karin", { description: error instanceof Error ? error.message : "Fadlan mar kale isku day." });
    } finally { setCreating(false); }
  };

  const handleCopyCode = async () => {
    if (!pairingResult) return;
    try { await navigator.clipboard.writeText(pairingResult.pairing_code); toast.success("Pairing code waa la koobiyeeyay"); }
    catch { toast.error("Copy ma shaqayn", { description: "Browser-ka u oggolow clipboard access." }); }
  };

  const handleRevoke = async (reader: SmsReaderRow) => {
    if (reader.status === "revoked" || reader.revoked_at) return;
    setRevokingId(reader.id);
    const { error } = await supabase.from("sms_readers")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", reader.id);
    setRevokingId(null);
    if (error) { toast.error("SMS Reader lama joojin karin", { description: error.message }); return; }
    await queryClient.invalidateQueries({ queryKey: ["sms-readers", merchantIds] });
    toast.success("SMS Reader waa la revoke-gareeyay; secret-kiisii sync ma samayn karo.");
  };

  const filteredReaders = readers.filter((reader) => reader.merchant_id === merchantId);
  const selectedMerchant = merchants.find((merchant) => merchant.id === merchantId);

  return (
    <Card>
      <Dialog open={pairingDialogOpen} onOpenChange={(open) => { setPairingDialogOpen(open); if (!open) setPairingResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>SMS Reader Pairing Code</DialogTitle>
            <DialogDescription>Koodhkan hal mar ayuu shaqaynayaa, wuxuuna dhacayaa 10 daqiiqo gudahood. Geli Android SMS Reader app-ka.</DialogDescription>
          </DialogHeader>
          {pairingResult && <div className="space-y-4">
            <div className="rounded-xl border p-4 space-y-2">
              <p className="text-sm text-muted-foreground">{pairingResult.label}</p>
              <p className="text-center font-mono text-2xl font-bold tracking-[0.18em]">{pairingResult.pairing_code}</p>
              <p className="text-center text-xs text-muted-foreground">Wuxuu dhacayaa: {new Date(pairingResult.expires_at).toLocaleString()}</p>
            </div>
            <p className="text-sm text-muted-foreground">{pairingResult.instructions}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPairingDialogOpen(false)}>Xir</Button>
              <Button onClick={() => void handleCopyCode()}><Copy className="mr-2 h-4 w-4" /> Copy Code</Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /> Android SMS Readers</CardTitle>
        <CardDescription>Reader-ku wuxuu gudbiyaa oo keliya transaction fields la aqoonsaday; raw SMS body lama upload-gareeyo. Xaaladda iyo last seen si toos ah ayaa loo cusboonaysiiyaa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {merchants.length === 0 ? <p className="text-sm text-muted-foreground">Ganacsade lama helin.</p> : <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ganacsade</Label>
              <Select value={merchantId} onValueChange={setMerchantId}><SelectTrigger><SelectValue placeholder="Dooro ganacsade" /></SelectTrigger>
                <SelectContent>{merchants.map((merchant) => <SelectItem key={merchant.id} value={merchant.id}>{merchant.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Laanta (ikhtiyaari)</Label>
              <Select value={branchId} onValueChange={setBranchId}><SelectTrigger><SelectValue placeholder="Ganacsiga oo dhan" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Ganacsiga oo dhan</SelectItem>{visibleBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Magaca telefoonka / SMS Reader-ka</Label>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Tusaale: Samsung Shop 01" maxLength={100} />
            </div>
          </div>
          <Button onClick={() => void handleCreatePairing()} disabled={creating || !merchantId}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Samee Pairing Code
          </Button>
          {selectedMerchant && <p className="text-xs text-muted-foreground">Reader-kan wuxuu ku xirnaan doonaa {selectedMerchant.name}. Qalab la paired-gareeyay wuxuu u baahan yahay revoke iyo pairing cusub si ganacsi kale loogu wareejiyo.</p>}
        </>}

        <div className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">SMS Readers-ka ganacsigan</h3>
            <Button variant="outline" size="sm" onClick={() => void queryClient.invalidateQueries({ queryKey: ["sms-readers", merchantIds] })} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : "SMS Readers lama soo qaadi karin."}</p>}
          {isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : filteredReaders.length === 0 ? <p className="text-sm text-muted-foreground">Weli SMS Reader looma abuurin ganacsigan.</p>
            : <div className="space-y-3">{filteredReaders.map((reader) => {
              const branch = branches.find((item) => item.id === reader.branch_id);
              const revoked = reader.status === "revoked" || Boolean(reader.revoked_at);
              const model = [reader.device_manufacturer, reader.device_model].filter(Boolean).join(" ");
              return <div key={reader.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{reader.label}</p>
                    <p className="text-xs text-muted-foreground">{merchants.find((merchant) => merchant.id === reader.merchant_id)?.name ?? "Merchant"}{branch ? " · " + branch.name : ""}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{readableStatus(revoked ? "revoked" : reader.status)}</span>
                      <span>{lastSeenLabel(reader)}</span>
                      {model && <span>{model}</span>}
                      {reader.android_version && <span>Android {reader.android_version}</span>}
                      {reader.sim_last4 && <span>SIM •••• {reader.sim_last4}</span>}
                      {reader.app_version && <span>App {reader.app_version}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">Last sync: {reader.last_sync_at ? new Date(reader.last_sync_at).toLocaleString() : "Weli SMS transaction lama sync-gareyn"}</p>
                    {reader.last_seen_at && <p className="text-xs text-muted-foreground">Last seen: {new Date(reader.last_seen_at).toLocaleString()}</p>}
                  </div>
                  {!revoked && <Button size="sm" variant="outline" disabled={revokingId === reader.id} onClick={() => void handleRevoke(reader)}>
                    {revokingId === reader.id ? <Loader2 className="mr-2 h-4 w-4" /> : <ShieldOff className="mr-2 h-4 w-4" />} Revoke
                  </Button>}
                </div>
              </div>;
            })}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
