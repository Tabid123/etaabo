import { useParams, useSearchParams } from "react-router-dom";
import PaymentCard from "@/components/PaymentCard";
import { useMerchant, useMerchantPaymentMethods } from "@/hooks/useMerchant";
import { usePublicDevice } from "@/hooks/usePublicDevice";

const Pay = () => {
  const { deviceToken } = useParams<{ deviceToken?: string }>();
  const [searchParams] = useSearchParams();
  const merchantQuery = searchParams.get("merchant");

  // Hardware URLs use /p/:deviceToken and resolve merchant/branch server-side.
  // The legacy ?merchant= link is retained during the transition.
  const {
    data: publicDevice,
    isLoading: deviceLoading,
    error: deviceError,
  } = usePublicDevice(deviceToken);

  const merchantId = deviceToken ? (publicDevice?.merchant_key ?? null) : merchantQuery;
  const { data: merchant, isLoading: merchantLoading, error: merchantError } = useMerchant(merchantId);
  const {
    data: paymentMethods = [],
    isLoading: paymentMethodsLoading,
    error: paymentMethodsError,
  } = useMerchantPaymentMethods(merchant?.id);

  const noMerchantParam = !deviceToken && !merchantQuery;
  const invalidDevice = Boolean(deviceToken && !deviceLoading && !deviceError && !publicDevice);
  const error = deviceError ?? (invalidDevice ? new Error("Qalabkan NFC/QR ma shaqaynayo ama waa la joojiyay.") : null) ?? merchantError ?? paymentMethodsError;

  return (
    <div className="min-h-screen bg-background">
      <PaymentCard
        merchant={merchant ?? null}
        paymentMethods={paymentMethods}
        deviceId={publicDevice?.device_id ?? null}
        branchId={publicDevice?.branch_id ?? null}
        deviceLabel={publicDevice?.device_label ?? null}
        isLoading={deviceLoading || (merchantLoading || paymentMethodsLoading) && !noMerchantParam && !invalidDevice}
        error={error as Error | null}
        noMerchantParam={noMerchantParam}
      />
    </div>
  );
};

export default Pay;
