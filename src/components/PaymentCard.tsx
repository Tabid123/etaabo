import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Merchant, MerchantPaymentMethod } from "@/hooks/useMerchant";
import { getPaymentLogo } from "@/lib/paymentLogos";

interface PaymentCardProps {
  merchant: Merchant | null;
  paymentMethods: MerchantPaymentMethod[];
  isLoading: boolean;
  error: Error | null;
  noMerchantParam?: boolean;
}

type ActivePaymentMethod = MerchantPaymentMethod & {
  isLegacyFallback?: boolean;
};

const formatAmount = (value: number) =>
  value % 1 === 0 ? value.toString() : parseFloat(value.toFixed(2)).toString();

const PaymentCard = ({
  merchant,
  paymentMethods,
  isLoading,
  error,
  noMerchantParam,
}: PaymentCardProps) => {
  const [amount, setAmount] = useState("");
  const [dialerError, setDialerError] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMethods = useMemo<ActivePaymentMethod[]>(() => {
    if (paymentMethods.length > 0) return paymentMethods;
    if (!merchant) return [];

    return [
      {
        id: "legacy-evc",
        merchant_id: merchant.id,
        provider: "evc",
        label: "EVC Plus",
        phone_number: merchant.phone_number,
        ussd_template: `${merchant.ussd_base_code}{phone}*{amount}#`,
        logo_url: merchant.evc_logo_url,
        is_active: true,
        sort_order: 10,
        isLegacyFallback: true,
      },
    ];
  }, [merchant, paymentMethods]);

  useEffect(() => {
    if (!activeMethods.length) {
      setSelectedMethodId("");
      return;
    }

    if (!activeMethods.some((method) => method.id === selectedMethodId)) {
      setSelectedMethodId(activeMethods[0].id);
    }
  }, [activeMethods, selectedMethodId]);

  const selectedMethod =
    activeMethods.find((method) => method.id === selectedMethodId) ?? activeMethods[0];

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      setDialerError(null);
    }
  };

  const generateUssdCode = (method: ActivePaymentMethod, numericAmount: number) => {
    return method.ussd_template
      .replaceAll("{phone}", method.phone_number)
      .replaceAll("{amount}", formatAmount(numericAmount));
  };

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);

    if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setDialerError("Fadlan geli lacag sax ah");
      return;
    }

    if (!merchant) {
      setDialerError("Ganacsade lama helin");
      return;
    }

    if (!selectedMethod) {
      setDialerError("Hab lacag-bixin lama diyaarin");
      return;
    }

    setIsSubmitting(true);
    setDialerError(null);

    try {
      if (!selectedMethod.isLegacyFallback) {
        const { error: sessionError } = await supabase
          .from("payment_sessions")
          .insert({
            merchant_id: merchant.id,
            payment_method_id: selectedMethod.id,
            provider: selectedMethod.provider,
            amount: numericAmount,
            currency: merchant.currency,
            status: "initiated",
            source: "tap2pay",
          });

        if (sessionError) throw sessionError;
      }

      const ussdCode = generateUssdCode(selectedMethod, numericAmount);
      window.location.href = `tel:${ussdCode}`;
    } catch (submitError: any) {
      console.error("Payment initiation failed:", submitError);
      setDialerError(
        submitError?.message || "Lacag-bixinta lama bilaabi karin. Fadlan mar kale isku day."
      );
      setIsSubmitting(false);
    }
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
          Si aad lacag u bixiso, NFC-ga taabo ama QR Code-ka ganacsiga scan-garee.
        </p>
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
          <h2 className="text-2xl font-extrabold leading-tight">eTaabo</h2>
          <p className="text-sm font-medium mt-1 opacity-90">Tap. Pay. Track.</p>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-payment px-7 pt-10 pb-9 flex flex-col">
        <div className="mx-auto relative">
          <div
            className="p-[3px] rounded-full"
            style={{ background: "linear-gradient(135deg, #00B894, #1F2A37)" }}
          >
            <div
              className="w-20 h-20 rounded-full bg-card overflow-hidden flex items-center justify-center ring-4 ring-card"
              style={{ boxShadow: "0 14px 40px -10px rgb(0 184 148 / 0.4)" }}
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

        <h1 className="mt-5 text-center text-2xl font-bold text-foreground tracking-tight">
          {merchant.name}
        </h1>
        <p className="text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mt-2">
          Payment
        </p>

        <div className="mt-10 flex items-baseline justify-center gap-2">
          <span className="text-3xl font-bold text-muted-foreground">$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountChange}
            autoFocus
            className="w-auto max-w-[65%] text-center text-5xl text-foreground bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-foreground/30 tracking-tight font-semibold"
          />
        </div>

        <p className="mt-12 text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Select Payment Method
        </p>

        {activeMethods.length > 0 ? (
          <div className={`mt-5 grid gap-3 ${activeMethods.length === 1 ? "grid-cols-1" : activeMethods.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {activeMethods.map((paymentMethod) => {
              const isActive = selectedMethod?.id === paymentMethod.id;

              return (
                <button
                  key={paymentMethod.id}
                  type="button"
                  onClick={() => setSelectedMethodId(paymentMethod.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-xl border transition-all duration-200 px-2 ${
                    isActive
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  {getPaymentLogo(paymentMethod.provider, paymentMethod.logo_url) ? (
                    <img
                      src={getPaymentLogo(paymentMethod.provider, paymentMethod.logo_url) || ""}
                      alt={paymentMethod.label}
                      className="h-7 w-auto max-w-[110px] object-contain"
                    />
                  ) : null}
                  <span className="text-sm font-semibold leading-none">
                    {paymentMethod.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-center text-sm text-destructive">
            Ganacsadahan wali hab lacag-bixin looma diyaarin.
          </p>
        )}

        {dialerError && (
          <p className="mt-5 text-destructive text-sm text-center">{dialerError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={
            isSubmitting ||
            !selectedMethod ||
            !amount ||
            !Number.isFinite(parseFloat(amount)) ||
            parseFloat(amount) <= 0
          }
          className="mt-10 flex w-full items-center justify-center rounded-full h-14 bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-primary-foreground text-base font-bold tracking-wide shadow-payment"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Furaya...
            </>
          ) : (
            "BIXI"
          )}
        </button>
      </div>

      <div className="flex items-center justify-center opacity-70">
        <p className="text-muted-foreground text-xs font-medium">
          eTaabo • Ammaan & Degdeg
        </p>
      </div>
    </div>
  );
};

export default PaymentCard;
