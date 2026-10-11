export const DEFAULT_PAYMENT_LOGOS: Record<string, string> = {
  evc: "/payment-logos/evc-plus.webp",
  edahab: "/payment-logos/edahab.webp",
  premier: "/payment-logos/premier-wallet.webp",
};

export const getPaymentLogo = (provider: string, customLogo?: string | null) =>
  customLogo || DEFAULT_PAYMENT_LOGOS[provider] || null;
