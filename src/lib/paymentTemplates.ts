export const MAX_PAYMENT_AMOUNT = 100000;

export const formatPaymentAmount = (value: number) =>
  value % 1 === 0 ? value.toString() : parseFloat(value.toFixed(2)).toString();

export function validateUssdTemplate(template: string): string | null {
  const value = template.trim();

  if (!value) return "Payment provider-ka USSD template-kiisa lama dejin.";
  if (/\s/.test(value)) return "USSD template-ku ma lahaan karo spaces.";
  if (!value.startsWith("*") || !value.endsWith("#")) {
    return "USSD template-ku waa inuu ku bilowdaa * kuna dhammaadaa #.";
  }
  if (!/^\*[A-Za-z0-9*{}+#.]+#$/.test(value)) {
    return "USSD template-ku wuxuu leeyahay xarfo aan la oggolayn.";
  }

  const placeholders = value.match(/\{[^}]*\}/g) ?? [];
  if (placeholders.some((placeholder) => placeholder !== "{phone}" && placeholder !== "{amount}")) {
    return "USSD template-ku wuxuu leeyahay placeholder aan la aqoon.";
  }
  if (placeholders.filter((placeholder) => placeholder === "{phone}").length !== 1) {
    return "USSD template-ka waa inuu hal mar ku jiraa {phone}.";
  }
  if (placeholders.filter((placeholder) => placeholder === "{amount}").length !== 1) {
    return "USSD template-ka waa inuu hal mar ku jiraa {amount}.";
  }

  return null;
}

export function buildUssdCode(
  template: string,
  phoneNumber: string,
  amount: number,
): string {
  const templateError = validateUssdTemplate(template);
  if (templateError) throw new Error(templateError);

  const phone = phoneNumber.trim();
  if (!/^\+?\d{6,20}$/.test(phone)) {
    throw new Error("Lambarka lacag-qaadashadu ma saxna. Hubi provider settings-ka.");
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PAYMENT_AMOUNT) {
    throw new Error(`Lacagtu waa inay ka weyn tahay 0 kana yaraan ama la mid noqotaa ${MAX_PAYMENT_AMOUNT}.`);
  }

  const code = template
    .trim()
    .replace("{phone}", phone)
    .replace("{amount}", formatPaymentAmount(amount));

  if (!/^\*[0-9+*.]+#$/.test(code)) {
    throw new Error("USSD code-ka la sameeyay ma saxna. Fadlan hubi template-ka.");
  }

  return code;
}

/**
 * '#' is the URI fragment delimiter, so encode it before passing a USSD
 * string to a tel: URI. Keep '*' and digits readable for the mobile dialer.
 */
export function toUssdTelHref(code: string): string {
  if (!/^\*[0-9+*.]+#$/.test(code)) {
    throw new Error("USSD code-ka lama furi karo sababtoo ah qaabkiisu ma saxna.");
  }
  return `tel:${code.replace(/#/g, "%23")}`;
}
