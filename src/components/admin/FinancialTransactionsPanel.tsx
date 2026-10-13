import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant } from "@/hooks/useMerchant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type TransactionRow = {
  id: string;
  merchant_id: string;
  direction: string;
  provider: string;
  amount: number;
  currency: string;
  counterparty: string | null;
  tx_id: string | null;
  occurred_at: string;
  verification_state: string;
  review_state: string;
  category_id: string | null;
  sms_body: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  kind: string;
};

export default function FinancialTransactionsPanel({ merchants }: { merchants: Merchant[] }) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const merchantNames = useMemo(
    () => Object.fromEntries(merchants.map((merchant) => [merchant.id, merchant.name])),
    [merchants]
  );

  const stats = useMemo(() => {
    const incoming = rows.filter((row) => row.direction === "incoming");
    const outgoing = rows.filter((row) => row.direction === "outgoing");

    return {
      incoming: incoming.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      outgoing: outgoing.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      needsReview: outgoing.filter((row) => row.review_state === "needs_review" || !row.category_id).length,
    };
  }, [rows]);

  const load = async () => {
    setLoading(true);

    let txQuery = supabase
      .from("financial_transactions")
      .select("id,merchant_id,direction,provider,amount,currency,counterparty,tx_id,occurred_at,verification_state,review_state,category_id,sms_body")
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (merchantFilter !== "all") txQuery = txQuery.eq("merchant_id", merchantFilter);
    if (directionFilter !== "all") txQuery = txQuery.eq("direction", directionFilter);

    const [{ data: txData, error: txError }, { data: categoryData, error: categoryError }] =
      await Promise.all([
        txQuery,
        supabase
          .from("expense_categories")
          .select("id,name,kind")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

    setLoading(false);

    if (txError) {
      toast.error("Transactions lama soo qaadi karin", { description: txError.message });
      return;
    }

    if (categoryError) {
      toast.error("Categories lama soo qaadi karin", { description: categoryError.message });
      return;
    }

    setRows((txData ?? []) as TransactionRow[]);
    setCategories((categoryData ?? []) as CategoryRow[]);
  };

  useEffect(() => {
    void load();
  }, [merchantFilter, directionFilter]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-financial-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "financial_transactions" },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [merchantFilter, directionFilter]);

  const classify = async (row: TransactionRow, categoryId: string) => {
    setActingId(row.id);
    const { error } = await supabase.rpc("classify_financial_transaction", {
      _transaction_id: row.id,
      _category_id: categoryId,
    });

    setActingId(null);

    if (error) {
      toast.error("Transaction lama verify-gareyn", { description: error.message });
      return;
    }

    toast.success("Outgoing transaction waa la kala saaray", { description: "Kala saaristu ma aha xaqiijin lacag-bixineed." });
    await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Money In / Money Out</CardTitle>
          <CardDescription>
            SMS Reader iyo manual/import transactions waxay halkan kasoo muuqanayaan. Incoming = Money In; outgoing lama tixgelinayo expense ilaa la classify-gareeyo.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Money In</p>
            <p className="mt-1 text-2xl font-bold">${stats.incoming.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Money Out</p>
            <p className="mt-1 text-2xl font-bold">${stats.outgoing.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Incoming Tx</p>
            <p className="mt-1 text-2xl font-bold">{stats.incomingCount}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Outgoing Tx</p>
            <p className="mt-1 text-2xl font-bold">{stats.outgoingCount}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Needs Review</p>
            <p className="mt-1 text-2xl font-bold">{stats.needsReview}</p>
          </div>
        </div>

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

          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="incoming">Money In</SelectItem>
              <SelectItem value="outgoing">Money Out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Financial transaction wali ma jiro.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${row.direction === "incoming" ? "bg-green-100" : "bg-orange-100"}`}>
                      {row.direction === "incoming" ? (
                        <ArrowDownLeft className="h-5 w-5 text-green-700" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-orange-700" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{row.currency} {Number(row.amount).toFixed(2)}</p>
                        <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase">{row.provider}</span>
                        <span className="rounded-full border px-2 py-1 text-[10px] font-semibold">
                          {row.direction === "incoming" ? "Money In" : "Money Out"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{merchantNames[row.merchant_id] ?? "Merchant"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.counterparty || "—"} {row.tx_id ? `• TX ${row.tx_id}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(row.occurred_at).toLocaleString()}</p>
                      {row.sms_body && <details className="mt-2 max-w-2xl rounded-lg border bg-muted/30 p-3 text-sm"><summary className="cursor-pointer font-medium">Eeg SMS body-ga buuxa</summary><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed">{row.sms_body}</p></details>}
                    </div>
                  </div>

                  {row.direction === "outgoing" && (row.review_state === "needs_review" || !row.category_id) ? (
                    <div className="min-w-[220px]">
                      <Select
                        disabled={actingId === row.id}
                        onValueChange={(value) => void classify(row, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={actingId === row.id ? "Saving..." : "Choose reason"} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : row.direction === "outgoing" ? (
                    <span className="rounded-full border px-3 py-1 text-xs font-semibold">La kala saaray · weli ma aha payment verification</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
