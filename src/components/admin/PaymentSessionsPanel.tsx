import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/hooks/useMerchant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type SessionRow = {
  id: string;
  merchant_id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  initiated_at: string;
  confirmed_at: string | null;
};

const statusLabels: Record<string, string> = {
  initiated: "Awaiting Confirmation",
  manual_confirmed: "Confirmed Manually",
  cancelled: "Cancelled",
};

export default function PaymentSessionsPanel({ merchants }: { merchants: Merchant[] }) {
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const merchantNames = useMemo(
    () => Object.fromEntries(merchants.map((merchant) => [merchant.id, merchant.name])),
    [merchants]
  );

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("payment_sessions")
      .select("id,merchant_id,provider,amount,currency,status,initiated_at,confirmed_at")
      .order("initiated_at", { ascending: false })
      .limit(100);

    if (merchantFilter !== "all") query = query.eq("merchant_id", merchantFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error("Payment sessions lama soo qaadi karin", { description: error.message });
      return;
    }
    setRows((data ?? []) as SessionRow[]);
  };

  useEffect(() => {
    void load();
  }, [merchantFilter, statusFilter]);

  const updateStatus = async (row: SessionRow, status: "manual_confirmed" | "cancelled") => {
    setActingId(row.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload =
      status === "manual_confirmed"
        ? {
            status,
            confirmed_at: new Date().toISOString(),
            confirmed_by: user?.id ?? null,
          }
        : {
            status,
            confirmed_at: null,
            confirmed_by: null,
          };

    const { error } = await supabase.from("payment_sessions").update(payload).eq("id", row.id);
    setActingId(null);

    if (error) {
      toast.error("Status lama beddeli karin", { description: error.message });
      return;
    }

    toast.success(status === "manual_confirmed" ? "Payment-ka waa la xaqiijiyay" : "Payment-ka waa la cancel gareeyay");
    await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Payment Sessions</CardTitle>
          <CardDescription>
            Tap2Pay attempts. “Confirmed Manually” waxay ka dhigan tahay cashier/admin ayaa SMS-ka telefoonka ka hubiyay.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={merchantFilter} onValueChange={setMerchantFilter}>
            <SelectTrigger><SelectValue placeholder="Merchant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Merchants</SelectItem>
              {merchants.map((merchant) => (
                <SelectItem key={merchant.id} value={merchant.id}>{merchant.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="initiated">Awaiting Confirmation</SelectItem>
              <SelectItem value="manual_confirmed">Confirmed Manually</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Payment session wali ma jiro.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold">{row.currency} {Number(row.amount).toFixed(2)}</p>
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase">
                        {row.provider}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{merchantNames[row.merchant_id] ?? "Merchant"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(row.initiated_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      {statusLabels[row.status] ?? row.status}
                    </p>
                  </div>

                  {row.status === "initiated" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateStatus(row, "manual_confirmed")}
                        disabled={actingId === row.id}
                      >
                        {actingId === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Confirm Paid
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(row, "cancelled")}
                        disabled={actingId === row.id}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
