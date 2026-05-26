import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMerchants, type Merchant } from "@/hooks/useMerchant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Shield, LogOut, Plus, Pencil, Trash2, Loader2, Store, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const Admin = () => {
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: merchants = [], isLoading: merchantsLoading } = useMerchants();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [formData, setFormData] = useState({
    merchant_id: "",
    name: "",
    phone_number: "",
    logo_url: "",
    banner_url: "",
    ussd_base_code: "712",
    currency: "USD",
    is_active: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Redirect if not authenticated or not admin
  if (!isLoading && (!user || !isAdmin)) {
    navigate("/admin/login", { replace: true });
    return null;
  }

  if (isLoading || merchantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      merchant_id: "",
      name: "",
      phone_number: "",
      logo_url: "",
      banner_url: "",
      ussd_base_code: "712",
      currency: "USD",
      is_active: true,
    });
    setEditingMerchant(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      merchant_id: merchant.merchant_id,
      name: merchant.name,
      phone_number: merchant.phone_number,
      logo_url: merchant.logo_url || "",
      banner_url: merchant.banner_url || "",
      ussd_base_code: merchant.ussd_base_code,
      currency: merchant.currency,
      is_active: merchant.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 5MB" });
      return;
    }
    setIsUploadingBanner(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeId = (formData.merchant_id || "tmp").replace(/[^a-zA-Z0-9_-]/g, "");
      const path = `${safeId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("merchant-banners")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("merchant-banners").getPublicUrl(path);
      setFormData((f) => ({ ...f, banner_url: data.publicUrl }));
      toast.success("Banner uploaded", {
        description: "Click Update Merchant to save",
      });
    } catch (err: any) {
      console.error("Banner upload error:", err);
      toast.error("Upload failed", { description: err.message || "Unknown error" });
    } finally {
      setIsUploadingBanner(false);
      // reset input so same file can be re-selected
      e.target.value = "";
    }
  };


  const handleSave = async () => {
    if (!formData.merchant_id || !formData.name || !formData.phone_number) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      if (editingMerchant) {
        // Update existing merchant
        const { error } = await supabase
          .from("merchants")
          .update({
            merchant_id: formData.merchant_id,
            name: formData.name,
            phone_number: formData.phone_number,
            logo_url: formData.logo_url || null,
            banner_url: formData.banner_url || null,
            ussd_base_code: formData.ussd_base_code,
            currency: formData.currency,
            is_active: formData.is_active,
          })
          .eq("id", editingMerchant.id);

        if (error) throw error;
        toast.success("Merchant updated successfully");
      } else {
        // Create new merchant
        const { error } = await supabase.from("merchants").insert({
          merchant_id: formData.merchant_id,
          name: formData.name,
          phone_number: formData.phone_number,
          logo_url: formData.logo_url || null,
          banner_url: formData.banner_url || null,
          ussd_base_code: formData.ussd_base_code,
          currency: formData.currency,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success("Merchant created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["merchants"] });
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error("Error saving merchant", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (merchant: Merchant) => {
    if (!confirm(`Are you sure you want to delete ${merchant.name}?`)) return;

    try {
      const { error } = await supabase
        .from("merchants")
        .delete()
        .eq("id", merchant.id);

      if (error) throw error;
      toast.success("Merchant deleted");
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
    } catch (error: any) {
      toast.error("Error deleting merchant", { description: error.message });
    }
  };

  const copyPaymentLink = (merchantId: string) => {
    const url = `${window.location.origin}/pay?merchant=${merchantId}`;
    navigator.clipboard.writeText(url);
    toast.success("Payment link copied!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Merchants
              </CardTitle>
              <CardDescription>
                Manage merchant accounts and payment settings
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Merchant
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingMerchant ? "Edit Merchant" : "Add New Merchant"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingMerchant
                      ? "Update merchant details and payment settings"
                      : "Create a new merchant for USSD payments"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="merchant_id">Merchant ID *</Label>
                    <Input
                      id="merchant_id"
                      placeholder="shop123"
                      value={formData.merchant_id}
                      onChange={(e) =>
                        setFormData({ ...formData, merchant_id: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Used in payment URL: /pay?merchant=shop123
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Business Name *</Label>
                    <Input
                      id="name"
                      placeholder="Mogadishu Market"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number *</Label>
                    <Input
                      id="phone_number"
                      placeholder="61XXXXXXX"
                      value={formData.phone_number}
                      onChange={(e) =>
                        setFormData({ ...formData, phone_number: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Merchant number for USSD code (without country code)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ussd_base_code">USSD Base Code</Label>
                    <Input
                      id="ussd_base_code"
                      placeholder="712"
                      value={formData.ussd_base_code}
                      onChange={(e) =>
                        setFormData({ ...formData, ussd_base_code: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: {formData.ussd_base_code}
                      {formData.phone_number || "XXXXXXX"}*AMOUNT#
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL (optional)</Label>
                    <Input
                      id="logo_url"
                      placeholder="https://example.com/logo.png"
                      value={formData.logo_url}
                      onChange={(e) =>
                        setFormData({ ...formData, logo_url: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banner_url">Promo Banner (optional)</Label>
                    {formData.banner_url && (
                      <img
                        src={formData.banner_url}
                        alt="Banner preview"
                        className="w-full aspect-[16/7] object-cover rounded-lg border border-border"
                      />
                    )}
                    <Input
                      id="banner_file"
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={isUploadingBanner}
                    />
                    <Input
                      id="banner_url"
                      placeholder="Or paste image URL"
                      value={formData.banner_url}
                      onChange={(e) =>
                        setFormData({ ...formData, banner_url: e.target.value })
                      }
                    />
                    {isUploadingBanner && (
                      <p className="text-xs text-muted-foreground">Uploading...</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Currency is locked to USD
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Active</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSave}
                    disabled={isSaving || isUploadingBanner}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : isUploadingBanner ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading banner...
                      </>
                    ) : editingMerchant ? (
                      "Update Merchant"
                    ) : (
                      "Create Merchant"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {merchants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground mb-2">
                  No merchants yet
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first merchant to start accepting payments
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Merchant
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-3">
                  {merchants.map((merchant) => (
                    <div
                      key={merchant.id}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                          {merchant.logo_url ? (
                            <img
                              src={merchant.logo_url}
                              alt={merchant.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Store className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {merchant.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {merchant.merchant_id}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                                merchant.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {merchant.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Phone</span>
                              <span className="font-mono text-foreground">
                                {merchant.phone_number}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">USSD</span>
                              <span className="font-mono text-foreground truncate">
                                *{merchant.ussd_base_code}
                                {merchant.phone_number}*AMT#
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyPaymentLink(merchant.merchant_id)}
                          title="Copy payment link"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            window.open(
                              `/pay?merchant=${merchant.merchant_id}`,
                              "_blank"
                            )
                          }
                          title="Preview"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(merchant)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(merchant)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>USSD Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {merchants.map((merchant) => (
                        <TableRow key={merchant.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                                {merchant.logo_url ? (
                                  <img
                                    src={merchant.logo_url}
                                    alt={merchant.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Store className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {merchant.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {merchant.merchant_id}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {merchant.phone_number}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {merchant.ussd_base_code}
                            {merchant.phone_number}*AMT#
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                merchant.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {merchant.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyPaymentLink(merchant.merchant_id)}
                                title="Copy payment link"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  window.open(
                                    `/pay?merchant=${merchant.merchant_id}`,
                                    "_blank"
                                  )
                                }
                                title="Preview payment page"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(merchant)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(merchant)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
