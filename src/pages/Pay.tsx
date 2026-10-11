import { useSearchParams } from "react-router-dom";
import PaymentCard from "@/components/PaymentCard";
import { useMerchant, useMerchantPaymentMethods } from "@/hooks/useMerchant";

const Pay = () => {
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get("merchant");

  const { data: merchant, isLoading, error } = useMerchant(merchantId);
  const {
    data: paymentMethods = [],
    isLoading: paymentMethodsLoading,
    error: paymentMethodsError,
  } = useMerchantPaymentMethods(merchant?.id);

  const noMerchantParam = !merchantId;

  return (
    <div className="min-h-screen bg-background">
      <PaymentCard
        merchant={merchant ?? null}
        paymentMethods={paymentMethods}
        isLoading={(isLoading || paymentMethodsLoading) && !noMerchantParam}
        error={(error || paymentMethodsError) as Error | null}
        noMerchantParam={noMerchantParam}
      />
    </div>
  );
};

export default Pay;
