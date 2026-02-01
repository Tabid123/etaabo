import { Link } from "react-router-dom";
import { Store, Shield, QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Store className="w-10 h-10 text-primary" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Somali Tap-to-Pay
        </h1>
        <p className="text-muted-foreground mb-8">
          USSD-powered mobile payments via QR code or NFC. No app download required.
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="flex flex-col items-center p-4 bg-card rounded-xl border border-border">
            <QrCode className="w-8 h-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground text-center">QR Scan</span>
          </div>
          <div className="flex flex-col items-center p-4 bg-card rounded-xl border border-border">
            <Smartphone className="w-8 h-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground text-center">USSD Dial</span>
          </div>
          <div className="flex flex-col items-center p-4 bg-card rounded-xl border border-border">
            <Shield className="w-8 h-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground text-center">Secure</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link to="/admin/login" className="block">
            <Button className="w-full" size="lg">
              <Shield className="w-4 h-4 mr-2" />
              Admin Panel
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            Customers access via payment links: /pay?merchant=ID
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
