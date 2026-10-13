import { describe, expect, it } from "vitest";
import { buildUssdCode, MAX_PAYMENT_AMOUNT, toUssdTelHref, validateUssdTemplate } from "./paymentTemplates";

describe("validateUssdTemplate", () => {
  it("accepts a provider template with phone and amount placeholders", () => {
    expect(validateUssdTemplate("*712*{phone}*{amount}#")).toBeNull();
  });

  it("rejects templates missing a required placeholder", () => {
    expect(validateUssdTemplate("*712*{phone}#")).toContain("{amount}");
    expect(validateUssdTemplate("*712*{amount}#")).toContain("{phone}");
  });

  it("rejects unsupported placeholders and malformed USSD wrappers", () => {
    expect(validateUssdTemplate("*712*{phone}*{value}#")).toContain("placeholder");
    expect(validateUssdTemplate("712*{phone}*{amount}#")).toContain("ku bilowdaa");
    expect(validateUssdTemplate("*712*{phone}*{amount}")).toContain("kuna dhammaadaa");
  });
});

describe("buildUssdCode", () => {
  it("uses the selected provider's own receiving number and amount", () => {
    expect(buildUssdCode("*712*{phone}*{amount}#", "612345678", 12.5))
      .toBe("*712*612345678*12.5#");
  });

  it("preserves the provider template order", () => {
    expect(buildUssdCode("*711*{amount}*{phone}#", "612345678", 3))
      .toBe("*711*3*612345678#");
  });

  it("rejects invalid phone numbers and out-of-range amounts", () => {
    expect(() => buildUssdCode("*712*{phone}*{amount}#", "abc", 5)).toThrow("Lambarka");
    expect(() => buildUssdCode("*712*{phone}*{amount}#", "612345678", 0)).toThrow("Lacagtu");
    expect(() => buildUssdCode("*712*{phone}*{amount}#", "612345678", MAX_PAYMENT_AMOUNT + 1)).toThrow("Lacagtu");
  });
});

describe("toUssdTelHref", () => {
  it("encodes the hash so it is not treated as a URL fragment", () => {
    expect(toUssdTelHref("*712*612345678*5#")).toBe("tel:*712*612345678*5%23");
  });

  it("does not create a dialer link for malformed input", () => {
    expect(() => toUssdTelHref("javascript:alert(1)")).toThrow();
  });
});
