import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Plus, QrCode, RefreshCw, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/hooks/useMerchant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type DeviceType = "table_mini" | "counter_stand" | "mobile_card";

type DeviceRow = {
  id: string;
  merchant_id: string;
  branch_id: string | null;
  label: string;
  device_type: string;
  public_token: string;
  status: string;
  revoked_at: string | null;
  created_at: string;
};

type BranchRow = {
  id: string;
  merchant_id: string;
  name: string;
  is_active: boolean;
};

const DEVICE_TYPES: Array<{ value: DeviceType; label: string }> = [
  { value: "table_mini", label: "Table Mini" },
  { value: "counter_stand", label: "Counter Stand" },
  { value: "mobile_card", label: "Mobile Card" },
];

const deviceTypeLabel = (value: string) =>
  DEVICE_TYPES.find((item) => item.value === value)?.label ?? value;

const publicDeviceUrl = (token: string) =>
  `https://etaabo.com/p/${encodeURIComponent(token)}`;

export default function DevicesPanel({ merchants }: { merchants: Merchant[] }) {
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState(merchants[0]?.id ?? "");
  const [branchId, setBranchId] = useState("none");
  const [label, setLabel] = useState("");
  const [deviceType, setDeviceType] = useState<DeviceType>("table_mini");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId && merchants.length > 0) setMerchantId(merchants[0].id);
    if (merchantId && !merchants.some((merchant) => merchant.id === merchantId)) {
      setMerchantId(merchants[0]?.id ?? "");
    }
  }, [merchants, merchantId]);

  useEffect(() => {
    setBranchId("none");
  }, [merchantId]);

  const merchantIds = useMemo(
    () => Array.from(new Set(merchants.map((merchant) => merchant.id))),
    [merchants],
  );

  const { data: branches = [] } = useQuery({
    queryKey: ["device-branches", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async (): Promise<BranchRow[]> => {
      const { data, error } = await supabase
        .from("branches")
        .select("id,merchant_id,name,is_active")
        .in("merchant_id", merchantIds)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BranchRow[];
    },
  });

  const visibleBranches = useMemo(
    () => branches.filter((branch) => branch.merchant_id === merchantId),
    [branches, merchantId],
  );

  const {
    data: devices = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["merchant-devices", merchantIds],
    enabled: merchantIds.length > 0,
    queryFn: async (): Promise<DeviceRow[]> => {
      const { data, error } = await supabase
        .from("devices")
        .select("id,merchant_id,branch_id,label,device_type,public_token,status,revoked_at,created_at")
        .in("merchant_id", merchantIds)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as DeviceRow[];
    },
  });

  const handleCreate = async () => {
    if (!merchantId) {
      toast.error("Dooro ganacsadaha qalabkan leh");
      return;
    }
    if (label.trim().length < 2) {
      toast.error("Geli magaca qalabka, tusaale: Table Mini 01");
      return;
    }
    const branch = branchId === "none" ? null : visibleBranches.find((item) => item.id === branchId);
    if (branchId !== "none" && !branch) {
      toast.error("Laanta la doortay lama helin");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("devices")
        .insert({
          merchant_id: merchantId,
          branch_id: branch?.id ?? null,
          label: label.trim(),
          device_type: deviceType,
          status: "active",
        })
        .select("id,merchant_id,branch_id,label,device_type,public_token,status,revoked_at,created_at")
        .single();
      if (error) throw error;

      setLabel("");
      await queryClient.invalidateQueries({ queryKey: ["merchant-devices", merchantIds] });
      toast.success("NFC/QR device waa la sameeyay");
      try {
        await navigator.clipboard.writeText(publicDeviceUrl(data.public_token));
        toast.success("Device link-ga waa la koobiyeeyay");
      } catch {
        // The link is displayed in the device list if clipboard access is unavailable.
      }
    } catch (error) {
      toast.error("Device lama abuuri karin", {
        description: error instanceof Error ? error.message : "Fadlan mar kale isku day.",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicDeviceUrl(token));
      toast.success("Device link-ga waa la koobiyeeyay");
    } catch {
      toast.error("Copy ma shaqayn", { description: "Browser-ka u oggolow clipboard access." });
    }
  };

  const handleRevoke = async (device: DeviceRow) => {
    if (device.status === "revoked" || device.revoked_at) return;
    setRevokingId(device.id);
    const { error } = await supabase
      .from("devices")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", device.id);
    setRevokingId(null);
    if (error) {
      toast.error("Device lama joojin karin", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["merchant-devices", merchantIds] });
    toast.success("Device waa la joojiyay. Link-gii hore hadda ma shaqaynayo.");
  };

  const filteredDevices = devices.filter((device) => device.merchant_id === merchantId);
  const selectedMerchant = merchants.find((merchant) => merchant.id === merchantId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          NFC / QR Devices
        </CardTitle>
        <CardDescription>
          Samee URL u gaar ah qalab kasta. NFC chip-ka iyo QR code-ku waa inay furaan isla URL-kan. Qalab luma waa la revoke-gareeyaa, link-giisii dib looma isticmaalo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {merchants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ganacsade lama helin.</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ganacsade</Label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger><SelectValue placeholder="Dooro ganacsade" /></SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>{merchant.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Laanta (ikhtiyaari)</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Ganacsiga oo dhan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ganacsiga oo dhan</SelectItem>
                    {visibleBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nooca qalabka</Label>
                <Select value={deviceType} onValueChange={(value) => setDeviceType(value as DeviceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Magaca qalabka</Label>
                <Input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Tusaale: Table Mini 01"
                  maxLength={100}
                />
              </div>
            </div>
            <Button onClick={() => void handleCreate()} disabled={creating || !merchantId}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Abuur Device Link
            </Button>
            {selectedMerchant && (
              <p className="text-xs text-muted-foreground">
                Ganacsade: {selectedMerchant.name}. Link-yada qalabkan waa kuwa dadweynuhu ku furayaan payment page-ka.
              </p>
            )}
          </>
        )}

        <div className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Qalabka ganacsigan</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["merchant-devices", merchantIds] })}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Qalabka lama soo qaadi karin."}</p>}
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Weli device looma abuurin ganacsigan.</p>
          ) : (
            <div className="space-y-3">
              {filteredDevices.map((device) => {
                const branch = branches.find((item) => item.id === device.branch_id);
                const revoked = device.status === "revoked" || Boolean(device.revoked_at);
                const url = publicDeviceUrl(device.public_token);
                return (
                  <div key={device.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold">{device.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {merchants.find((merchant) => merchant.id === device.merchant_id)?.name ?? "Merchant"} · {deviceTypeLabel(device.device_type)}{branch ? ` · ${branch.name}` : ""}
                        </p>
                        <p className="break-all font-mono text-xs">{url}</p>
                        <span className={revoked ? "inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground" : "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800"}>
                          {revoked ? "Revoked" : "Active"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!revoked && (
                          <Button size="sm" variant="outline" onClick={() => void handleCopy(device.public_token)}>
                            <Copy className="mr-2 h-4 w-4" />Copy Link
                          </Button>
                        )}
                        {!revoked && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={revokingId === device.id}
                            onClick={() => void handleRevoke(device)}
                          >
                            {revokingId === device.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
