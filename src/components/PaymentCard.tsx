import { useState } from "react";
import { Store, Send, ShieldCheck, AlertCircle } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { Merchant } from "@/hooks/useMerchant";
import storeBanner from "@/assets/store-banner.jpg";
import promoBanner from "@/assets/promo-banner.jpg";

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
  activeClass: string;
}[] = [
  {
    id: "evc",
    label: "EVC Plus",
    activeClass:
      "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "edahab",
    label: "eDahab",
    activeClass:
      "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    id: "premier",
    label: "Premier",
    activeClass:
      "border-primary bg-primary/10 text-primary",
  },
];

const PROMO_SLIDES = [promoBanner, promoBanner, promoBanner];

const PaymentCard = ({ merchant, isLoading, error, noMerchantParam }: PaymentCardProps) => {
  const [amount, setAmount] = useState("");
  const [dialerError, setDialerError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("evc");
  const [activeSlide, setActiveSlide] = useState(0);

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
      <div className="w-full max-w-[480px] bg-card rounded-2xl shadow-card border border-border min-h-[400px] flex flex-col items-center justify-center p-6">
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
      <div className="w-full max-w-[480px] bg-card rounded-2xl shadow-card border border-border min-h-[400px] flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Ganacsade Lama Helin</h2>
        <p className="text-muted-foreground text-center">
          Link-ga lacag bixintu ma shaqeynayo ama ganacsaduhu ma firfircona.
        </p>
      </div>
    );
  }

  const bannerImage = merchant.logo_url || storeBanner;

  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col min-h-screen bg-background">
      {/* Promo Carousel */}
      <div className="px-3 pt-3">
        <Carousel
          opts={{ loop: true }}
          setApi={(api) => {
            if (!api) return;
            api.on("select", () => setActiveSlide(api.selectedScrollSnap()));
          }}
          className="rounded-2xl overflow-hidden"
        >
          <CarouselContent>
            {PROMO_SLIDES.map((src, i) => (
              <CarouselItem key={i}>
                <img
                  src={src}
                  alt={`Promotion ${i + 1}`}
                  className="w-full h-28 object-cover rounded-2xl"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="flex justify-center gap-1.5 mt-2">
          {PROMO_SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeSlide === i ? "w-5 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative mt-4 mx-3 h-44 rounded-2xl overflow-hidden">
        <img
          src={bannerImage}
          alt={merchant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      </div>

      {/* Overlapping Card */}
      <div className="relative -mt-10 mx-3 bg-card rounded-3xl shadow-card border border-border pt-14 pb-6 px-6 flex-1 flex flex-col">
        {/* Merchant Logo overlapping top edge */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-10 w-20 h-20 rounded-full bg-card border-4 border-card shadow-card overflow-hidden flex items-center justify-center">
          {merchant.logo_url ? (
            <img
              src={merchant.logo_url}
              alt={merchant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Store className="w-10 h-10 text-primary" />
            </div>
          )}
        </div>

        {/* Name + subtitle */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">{merchant.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Payment</p>
        </div>

        {/* Amount input */}
        <div className="mt-6 flex flex-col items-center">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountChange}
            autoFocus
            className="w-full text-center text-5xl font-bold text-foreground bg-transparent border-0 focus:ring-0 focus:outline-none placeholder:text-muted-foreground/40"
          />
          <div className="mt-2 inline-flex items-center gap-1 bg-secondary px-3 py-1 rounded-full text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {merchant.currency}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Select Payment Method
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const isActive = method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`relative h-11 rounded-xl border-2 text-sm font-semibold transition-all duration-300 ease-out ${
                    isActive
                      ? `${m.activeClass} scale-[1.03] shadow-sm`
                      : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {dialerError && (
          <p className="mt-4 text-destructive text-sm text-center">
            {dialerError}
          </p>
        )}

        {/* DIR Button */}
        <div className="mt-auto pt-6">
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl h-14 bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-primary-foreground text-lg font-bold tracking-wide shadow-payment"
          >
            <span>DIR</span>
            <Send className="w-5 h-5" />
          </button>
          <div className="flex items-center justify-center pt-4 gap-2 opacity-70">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <p className="text-muted-foreground text-xs font-medium">
              Ammaan & Degdeg
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCard;
