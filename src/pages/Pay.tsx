import { useSearchParams } from "react-router-dom";
import PaymentCard from "@/components/PaymentCard";
import { useMerchant } from "@/hooks/useMerchant";

const Pay = () => {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get("merchant");
  
  const { data: merchant, isLoading, error } = useMerchant(merchantId);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <PaymentCard 
        merchant={merchant ?? null} 
        isLoading={isLoading} 
        error={error as Error | null}
      />
    </div>
  );
};

export default Pay;
