import { useState } from "react";
import { Store, AlertCircle, Star, CheckCircle2 } from "lucide-react";
import type { Merchant } from "@/hooks/useMerchant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("evc");
  const [paymentStep, setPaymentStep] = useState<"entry" | "waiting" | "rating" | "done">("entry");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const playConfirmationSound = () => {
    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      void context.resume().then(() => {
        [660, 880].forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = context.currentTime + index * 0.14;
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.23);
        });
        window.setTimeout(() => void context.close(), 650);
      }).catch(() => void context.close());
    } catch {
      // Audio may be blocked or unavailable; keep the feedback flow usable.
    }
  };

  const submitFeedback = async () => {
    if (!merchant || rating === 0 || isSending) return;
    setIsSending(true);
    setFeedbackError(null);
    const { error: saveError } = await supabase.from("merchant_feedback").insert({
      merchant_id: merchant.id,
      rating,
      comment: comment.trim() || null,
    });
    setIsSending(false);
    if (saveError) {
      setFeedbackError("Qiimeynta lama dirin. Fadlan mar kale isku day.");
      return;
    }
    setPaymentStep("done");
  };

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
    setDialerError(null);
    setConfirmOpen(true);
  };

  const confirmPayment = () => {
    const ussdCode = generateUssdCode();
    if (!ussdCode) return;
    setConfirmOpen(false);
    setPaymentStep("waiting");
    window.location.href = `tel:${ussdCode}`;
  };

  const methodLabel = PAYMENT_METHODS.find((m) => m.id === method)?.label ?? "";
  const methodLogo =
    method === "evc"
      ? merchant?.evc_logo_url
      : method === "edahab"
      ? merchant?.edahab_logo_url
      : merchant?.premier_logo_url;

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
      {merchant.banner_url ? (
        <div className="relative rounded-2xl overflow-hidden shadow-payment aspect-[16/7] bg-secondary">
          <img
            src={merchant.banner_url}
            alt={`${merchant.name} banner`}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="relative rounded-2xl overflow-hidden p-5 text-white shadow-payment"
          style={{ background: "var(--gradient-promo)" }}
        >
          <h2 className="text-2xl font-extrabold leading-tight">
            Mobile<br />Payment
          </h2>
          <p className="text-sm font-medium mt-1 opacity-90">
            Buy our system payment App...
          </p>
        </div>
      )}

      {/* Payment Card */}
      <div className="bg-card rounded-2xl shadow-payment px-7 pt-10 pb-9 flex flex-col">
        {/* Merchant Logo - fancy circle */}
        <div className="mx-auto relative">
          <div
            className="p-[3px] rounded-full"
            style={{ background: "linear-gradient(135deg, hsl(219 100% 39%), hsl(219 100% 60%))" }}
          >
            <div
              className="w-20 h-20 rounded-full bg-card overflow-hidden flex items-center justify-center ring-4 ring-card"
              style={{ boxShadow: "0 14px 40px -10px hsl(219 100% 39% / 0.55), 0 4px 14px -2px hsl(219 100% 39% / 0.25)" }}
            >
              {merchant.logo_url ? (
                <img
                  src={merchant.logo_url}
                  alt={merchant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-9 h-9 text-primary" />
              )}
            </div>
          </div>
        </div>

        {/* Name */}
        <h1 className="mt-5 text-center text-2xl font-bold text-foreground tracking-tight">
          {merchant.name}
        </h1>
        <p className="text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mt-2">
          Payment
        </p>

        {paymentStep === "waiting" ? (
          <div className="mt-10 text-center space-y-5" aria-live="polite">
            <p className="text-sm text-muted-foreground">Markaad USSD-ga ku dhammayso lacag-bixinta, halkan ku xaqiiji.</p>
            <Button className="w-full h-14 rounded-full font-bold" onClick={() => { playConfirmationSound(); setPaymentStep("rating"); }}>
              Waan bixiyey
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setPaymentStep("entry")}>Dib u noqo</Button>
          </div>
        ) : paymentStep === "rating" || paymentStep === "done" ? (
          <div className="mt-9 text-center" aria-live="polite">
            <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-foreground">Waad mahadsan tahay</h2>
            <p className="mt-2 text-sm text-muted-foreground">Lacag-bixintaada adigaa xaqiijiyey. Sidee ahayd adeeggu?</p>
            {paymentStep === "rating" ? (
              <div className="mt-6 space-y-5">
                <div className="flex justify-center gap-1" role="group" aria-label="Qiimee adeegga 1 ilaa 5 xiddigood">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button key={star} type="button" variant="ghost" size="icon" className="size-11 p-0 hover:bg-transparent" aria-label={`${star} xiddig${star === 1 ? "" : "ood"}`} aria-pressed={rating === star} onClick={() => setRating(star)}>
                      <Star className={`!size-8 ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                    </Button>
                  ))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder="Fikirkaaga (ikhtiyaari)" aria-label="Fikirkaaga" className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {feedbackError && <p role="alert" className="text-sm text-destructive">{feedbackError}</p>}
                <Button className="w-full h-12 rounded-full" disabled={!rating || isSending} onClick={submitFeedback}>{isSending ? "Waa la dirayaa..." : "Dir qiimeynta"}</Button>
                <Button variant="ghost" className="w-full" onClick={() => setPaymentStep("done")}>Ka bood</Button>
              </div>
            ) : <p className="mt-5 text-sm text-primary">Mahadsanid!</p>}
            {paymentStep === "done" && <Button variant="outline" className="mt-6" onClick={() => { setAmount(""); setRating(0); setComment(""); setPaymentStep("entry"); }}>Lacag kale bixi</Button>}
          </div>
        ) : <>
        {/* Amount */}
        <div className="mt-10 flex items-baseline justify-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountChange}
            autoFocus
            className="w-auto max-w-[60%] text-center text-5xl text-foreground bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-foreground/30 tracking-tight font-semibold"
          />
        </div>


        {/* Methods */}
        <p className="mt-12 text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Select Payment Method
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {PAYMENT_METHODS.map((m) => {
            const isActive = method === m.id;
            const logoUrl =
              m.id === "evc"
                ? merchant.evc_logo_url
                : m.id === "edahab"
                ? merchant.edahab_logo_url
                : merchant.premier_logo_url;
            return (
              <Button
                type="button"
                variant="outline"
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-xl border transition-all duration-200 px-2 ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/40"
                }`}
              >
                {logoUrl ? (
                  <>
                    <img
                      src={logoUrl}
                      alt={m.label}
                      className="h-7 w-auto object-contain"
                    />
                    <span className="text-[10px] font-semibold leading-none">{m.label}</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold">{m.label}</span>
                )}
              </Button>
            );
          })}
        </div>

        {dialerError && (
          <p className="mt-5 text-destructive text-sm text-center">
            {dialerError}
          </p>
        )}

        {/* DIR Button */}
        <Button
          onClick={handleSubmit}
          disabled={!amount || parseFloat(amount) <= 0}
          className="mt-10 flex w-full items-center justify-center rounded-full h-14 bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-primary-foreground text-base font-bold tracking-wide shadow-payment"
        >
          DIR
        </Button>
        </>}
      </div>


      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl bg-card px-6 py-6 gap-0 shadow-payment [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold tracking-tight text-foreground">
              Xaqiiji Lacag Bixinta
            </DialogTitle>
          </DialogHeader>

          <div className="mt-5 flex flex-col items-center gap-4">
            {/* Merchant */}
            <div className="flex w-full items-center gap-3 rounded-xl bg-muted/60 p-3">
              {merchant.logo_url ? (
                <img src={merchant.logo_url} alt={merchant.name} className="size-10 shrink-0 rounded-full object-cover ring-1 ring-border" />
              ) : (
                <Store className="size-6 shrink-0 text-primary" />
              )}
              <span className="truncate text-sm font-semibold text-foreground">{merchant.name}</span>
            </div>

            {/* Amount */}
            <div className="text-center">
              <p className="text-4xl font-bold tracking-tight text-foreground">{amount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">USD</p>
            </div>

            {/* Method */}
            <div className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-2">
              {methodLogo && <img src={methodLogo} alt={methodLabel} className="h-5 w-auto object-contain" />}
              <span className="text-sm font-semibold text-foreground">{methodLabel}</span>
            </div>

            {/* USSD preview */}
            <div className="w-full rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">USSD Code</p>
              <code className="mt-1 block break-all text-sm font-bold text-primary">{generateUssdCode()}</code>
            </div>

            <Button className="mt-1 h-14 w-full rounded-full font-bold" onClick={confirmPayment}>
              Xaqiiji & Wac
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setConfirmOpen(false)}>
              Jooji
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
