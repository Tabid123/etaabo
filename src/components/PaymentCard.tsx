import { useState } from "react";
import { Store, Send, ShieldCheck } from "lucide-react";

const PaymentCard = () => {
  const [amount, setAmount] = useState("");

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only valid decimal numbers
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSubmit = () => {
    if (amount && parseFloat(amount) > 0) {
      // Handle payment submission
      console.log("Sending payment:", amount);
    }
  };

  return (
    <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden bg-card rounded-lg shadow-card border border-border min-h-[600px]">
      {/* Header Section */}
      <div className="relative flex flex-col items-center pt-10 pb-2 px-6">
        {/* Business Logo */}
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-5 shadow-sm border border-border">
          <Store className="w-12 h-12 text-primary" />
        </div>

        {/* Business Name */}
        <h1 className="text-foreground text-2xl font-bold tracking-tight text-center leading-tight">
          Mogadishu Market
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
      <div className="flex justify-center pt-2 pb-8">
        <div className="bg-secondary px-3 py-1 rounded text-xs font-bold text-muted-foreground uppercase tracking-widest">
          USD
        </div>
      </div>

      {/* Action Button */}
      <div className="flex px-6 mt-auto mb-4">
        <button
          onClick={handleSubmit}
          className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 bg-primary hover:bg-primary/90 active:bg-primary/80 transition-colors text-primary-foreground text-lg font-bold leading-normal tracking-wide shadow-payment"
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
