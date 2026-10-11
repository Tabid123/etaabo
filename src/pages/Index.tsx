import { Store, Shield, QrCode, Smartphone } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Store className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-3">
          eTaabo
        </h1>
        <p className="text-muted-foreground mb-8">
          Ku taabo NFC-ga ama scan-garee QR Code-ka ganacsiga si aad lacagta si fudud ugu bixiso.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="flex flex-col items-center p-4 bg-card rounded-xl border border-border">
            <QrCode className="w-8 h-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground text-center">QR Scan</span>
          </div>
          <div className="flex flex-col items-center p-4 bg-card rounded-xl border border-border">
            <Smartphone className="w-8 h-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground text-center">Tap & Pay</span>
          </div>
          <div className="flex flex-col items-center p-4 bg-card rounded-xl border border-border">
            <Shield className="w-8 h-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground text-center">Secure</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Customer-ku app uma baahna. NFC ama QR ayaa payment page-ka furaya.
        </p>
      </div>
    </div>
  );
};

export default Index;
