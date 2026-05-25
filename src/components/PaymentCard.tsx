import { useState } from "react";
import { Store, AlertCircle } from "lucide-react";
import type { Merchant } from "@/hooks/useMerchant";

interface PaymentCardProps {
  merchant: Merchant | null;
  isLoading: boolean;
  error: Error | null;
  noMerchantParam?: boolean;
}

type PaymentMethod = "evc" | "edahab" | "premier";

const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
}[] = [
  { id: "evc", label: "EVC Plus" },
  { id: "edahab", label: "eDahab" },
  { id: "premier", label: "Premier" },
];

const PaymentCard = ({ merchant, isLoading, error, noMerchantParam }: PaymentCardProps) => {
  const [amount, setAmount] = useState("");
  const [dialerError, setDialerError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("evc");

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      setDialerError(null);
    }
  };

  const generateUssdCode = () => {
    if (!merchant || !amount) return null;
    const numAmount = parseFloat(amount);
    const formattedAmount =
      numAmount % 1 === 0
        ? numAmount.toString()
        : parseFloat(numAmount.toFixed(2)).toString();
    return `${merchant.ussd_base_code}${merchant.phone_number}*${formattedAmount}#`;
  };

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setDialerError("Fadlan geli lacag sax ah");
      return;
    }
    if (!merchant) {
      setDialerError("Ganacsade lama helin");
      return;
    }
    const ussdCode = generateUssdCode();
    if (!ussdCode) return;
    window.location.href = `tel:${ussdCode}`;
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[480px] min-h-[600px] flex flex-col items-center justify-center">
        <div className="animate-pulse-soft">
          <Store className="w-16 h-16 text-primary opacity-50" />
        </div>
        <p className="text-muted-foreground mt-4">Loading merchant...</p>
      </div>
    );
  }

  if (noMerchantParam) {
    return (
      <div className="w-full max-w-[480px] bg-card rounded-2xl shadow-card border border-border min-h-[400px] flex flex-col items-center justify-center p-6 mx-auto mt-6">
        <Store className="w-16 h-16 text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">Bogga Lacag Bixinta</h2>
        <p className="text-muted-foreground text-center mb-4">
          Si aad lacag u bixiso, u isticmaal link-ga uu ganacsadaha kuu siiyey.
        </p>
        <div className="bg-secondary rounded-lg p-4 w-full">
          <code className="text-sm text-primary block text-center font-mono">
            /pay?merchant=shop001
          </code>
        </div>
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="w-full max-w-[480px] bg-card rounded-2xl shadow-card border border-border min-h-[400px] flex flex-col items-center justify-center p-6 mx-auto mt-6">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Ganacsade Lama Helin</h2>
        <p className="text-muted-foreground text-center">
          Link-ga lacag bixintu ma shaqeynayo ama ganacsaduhu ma firfircona.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen px-5 pt-5 pb-6 gap-5">
      {/* Promo Banner */}
      <div
        className="relative rounded-xl overflow-hidden p-5 text-white"
        style={{ background: "var(--gradient-promo)" }}
      >
        <h2 className="text-2xl font-extrabold leading-tight">
          Mobile<br />Payment
        </h2>
        <p className="text-sm font-medium mt-1 opacity-90">
          Buy our system payment App...
        </p>
        <span className="absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/25 backdrop-blur-sm" />
      </div>

      {/* Payment Card */}
      <div className="bg-card rounded-xl shadow-card border border-border/60 px-6 pt-7 pb-6 flex flex-col">
        {/* Merchant Logo */}
        <div className="mx-auto w-16 h-16 rounded-full bg-secondary border border-border/60 overflow-hidden flex items-center justify-center">
          {merchant.logo_url ? (
            <img
              src={merchant.logo_url}
              alt={merchant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Store className="w-8 h-8 text-primary" />
          )}
        </div>

        {/* Name */}
        <h1 className="mt-3 text-center text-2xl font-bold text-foreground tracking-tight">
          {merchant.name}
        </h1>
        <p className="text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mt-1">
          Payment
        </p>

        {/* Amount */}
        <div className="mt-6 flex items-baseline justify-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountChange}
            autoFocus
            className="w-auto max-w-[60%] text-center text-5xl font-extrabold text-foreground bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-foreground/30 placeholder:font-light tracking-tight"
          />
          <span className="text-base font-bold text-muted-foreground uppercase">
            {merchant.currency}
          </span>
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Lacagta lagu bixinayo {merchant.currency}
        </p>

        {/* Methods */}
        <p className="mt-7 text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Select Payment Method
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {PAYMENT_METHODS.map((m) => {
            const isActive = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex items-center justify-center h-14 rounded-lg border transition-all duration-200 ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                }`}
              >
                <span className="text-sm font-semibold">{m.label}</span>
              </button>
            );
          })}
        </div>

        {dialerError && (
          <p className="mt-4 text-destructive text-sm text-center">
            {dialerError}
          </p>
        )}

        {/* DIR Button */}
        <button
          onClick={handleSubmit}
          disabled={!amount || parseFloat(amount) <= 0}
          className="mt-7 flex w-full items-center justify-center rounded-full h-14 bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-primary-foreground text-base font-bold tracking-wide shadow-payment"
        >
          DIR
        </button>
      </div>

      {/* Security badge */}
      <div className="flex items-center justify-center opacity-70">
        <p className="text-muted-foreground text-xs font-medium">
          Ammaan & Degdeg
        </p>
      </div>
    </div>
  );
};

export default PaymentCard;
