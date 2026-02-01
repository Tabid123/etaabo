import { useState } from "react";
import { Store, Send, ShieldCheck, AlertCircle } from "lucide-react";
import type { Merchant } from "@/hooks/useMerchant";

interface PaymentCardProps {
  merchant: Merchant | null;
  isLoading: boolean;
  error: Error | null;
}

const PaymentCard = ({ merchant, isLoading, error }: PaymentCardProps) => {
  const [amount, setAmount] = useState("");
  const [dialerError, setDialerError] = useState<string | null>(null);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only valid decimal numbers
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      setDialerError(null);
    }
  };

  const generateUssdCode = () => {
    if (!merchant || !amount) return null;
    
    // Format: {ussd_base_code}{MERCHANT_NUMBER}*{AMOUNT}#
    // Example: 71261XXXXXXX*10.00#
    const formattedAmount = parseFloat(amount).toFixed(2);
    return `${merchant.ussd_base_code}${merchant.phone_number}*${formattedAmount}#`;
  };

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setDialerError("Please enter a valid amount");
      return;
    }

    if (!merchant) {
      setDialerError("Merchant not found");
      return;
    }

    const ussdCode = generateUssdCode();
    if (!ussdCode) return;

    // Use tel: scheme to open dialer with USSD code
    const telUri = `tel:${ussdCode}`;
    
    // Try to open dialer
    window.location.href = telUri;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden bg-card rounded-lg shadow-card border border-border min-h-[600px] items-center justify-center">
        <div className="animate-pulse-soft">
          <Store className="w-16 h-16 text-primary opacity-50" />
        </div>
        <p className="text-muted-foreground mt-4">Loading merchant...</p>
      </div>
    );
  }

  // Error state
  if (error || !merchant) {
    return (
      <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden bg-card rounded-lg shadow-card border border-border min-h-[600px] items-center justify-center p-6">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Merchant Not Found</h2>
        <p className="text-muted-foreground text-center">
          The payment link is invalid or the merchant is no longer active.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden bg-card rounded-lg shadow-card border border-border min-h-[600px]">
      {/* Header Section */}
      <div className="relative flex flex-col items-center pt-10 pb-2 px-6">
        {/* Business Logo */}
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-5 shadow-sm border border-border overflow-hidden">
          {merchant.logo_url ? (
            <img 
              src={merchant.logo_url} 
              alt={merchant.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <Store className="w-12 h-12 text-primary" />
          )}
        </div>

        {/* Business Name */}
        <h1 className="text-foreground text-2xl font-bold tracking-tight text-center leading-tight">
          {merchant.name}
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground text-sm font-medium leading-normal pt-2 text-center">
          Tap to Pay – USSD Payment
        </p>
      </div>

      {/* Spacer */}
      <div className="h-6" />

      {/* Input Section */}
      <div className="flex flex-col px-6">
        <label className="flex flex-col w-full">
          <p className="text-foreground text-sm font-semibold leading-normal pb-3 uppercase tracking-wider text-center">
            Gali lacagta
          </p>
          <div className="flex w-full items-center justify-center relative">
            <div className="relative w-full">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                autoFocus
                className="block w-full text-center text-5xl font-bold text-foreground bg-transparent border-0 border-b-2 border-border focus:border-primary focus:ring-0 focus:outline-none placeholder:text-muted py-4 transition-colors"
              />
            </div>
          </div>
        </label>
      </div>

      {/* Currency Badge */}
      <div className="flex justify-center pt-2 pb-4">
        <div className="bg-secondary px-3 py-1 rounded text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {merchant.currency}
        </div>
      </div>

      {/* Error Message */}
      {dialerError && (
        <div className="px-6 pb-4">
          <p className="text-destructive text-sm text-center">{dialerError}</p>
        </div>
      )}

      {/* Action Button */}
      <div className="flex px-6 mt-auto mb-4">
        <button
          onClick={handleSubmit}
          disabled={!amount || parseFloat(amount) <= 0}
          className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 bg-primary hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-primary-foreground text-lg font-bold leading-normal tracking-wide shadow-payment"
        >
          <span className="mr-2">DIR</span>
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Footer Security Note */}
      <div className="flex items-center justify-center pb-6 gap-2 opacity-80">
        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
        <p className="text-muted-foreground text-xs font-medium">
          Ammaan & Degdeg
        </p>
      </div>
    </div>
  );
};

export default PaymentCard;
