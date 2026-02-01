import { useSearchParams } from "react-router-dom";
import PaymentCard from "@/components/PaymentCard";
import { useMerchant } from "@/hooks/useMerchant";

const Pay = () => {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get("merchant");
  
  const { data: merchant, isLoading, error } = useMerchant(merchantId);

  // If no merchant ID provided, show helpful message
  const noMerchantParam = !merchantId;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <PaymentCard 
        merchant={merchant ?? null} 
        isLoading={isLoading && !noMerchantParam} 
        error={error as Error | null}
        noMerchantParam={noMerchantParam}
      />
    </div>
  );
};

export default Pay;
