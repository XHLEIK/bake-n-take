import { describe, expect, it } from "vitest";

import { storeSettingsSchema } from "./validation";
import { WEEK_DAYS } from "./types";

function baseInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    storeName: "Bake n Take",
    tagline: "Fresh daily",
    description: "Neighbourhood bakery.",
    phonePrimary: "+91 98765 43210",
    phoneSecondary: "",
    email: "hello@example.com",
    whatsapp: "919876543210",
    addressLine1: "12 Baker Street",
    addressLine2: "",
    locality: "Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400050",
    country: "India",
    mapsUrl: "https://maps.google.com/?q=test",
    latitude: "19.0760",
    longitude: "72.8777",
    socialsJson: JSON.stringify({ instagram: "https://instagram.com/bakentake" }),
    hoursJson: JSON.stringify(
      Object.fromEntries(
        WEEK_DAYS.map((day) => [day, { open: true, opens_at: "09:00", closes_at: "21:00" }]),
      ),
    ),
    pickupInstructions: "Collect from the counter.",
    pickupLocation: "Main counter",
    pickupNotes: "",
    pickupEta: "Ready in 20 minutes",
    isOpen: "1",
    acceptingOrders: "1",
    statusMessage: "",
    currency: "inr",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    logoRemoved: "0",
    faviconRemoved: "0",
    ...overrides,
  };
}

describe("storeSettingsSchema", () => {
  it("accepts a complete valid payload and normalises it", () => {
    const result = storeSettingsSchema.safeParse(baseInput());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.currency).toBe("INR");
    expect(result.data.latitude).toBe(19.076);
    expect(result.data.phoneSecondary).toBeNull();
    expect(result.data.isOpen).toBe(true);
  });

  it("requires the store name", () => {
    const result = storeSettingsSchema.safeParse(baseInput({ storeName: "  " }));

    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.error.issues.map((issue) => issue.path.join("."));
    expect(fields).toContain("storeName");
  });

  it("rejects bad contact formats", () => {
    const result = storeSettingsSchema.safeParse(
      baseInput({ email: "not-an-email", phonePrimary: "call me", mapsUrl: "javascript:alert(1)" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects out-of-range coordinates and malformed timezones", () => {
    expect(storeSettingsSchema.safeParse(baseInput({ latitude: "91" })).success).toBe(false);
    expect(storeSettingsSchema.safeParse(baseInput({ longitude: "-181" })).success).toBe(false);
    expect(storeSettingsSchema.safeParse(baseInput({ timezone: "Not A Zone!" })).success).toBe(
      false,
    );
    expect(storeSettingsSchema.safeParse(baseInput({ timezone: "UTC" })).success).toBe(true);
  });

  it("rejects closing before opening and malformed hours JSON", () => {
    const badHours = JSON.stringify({
      ...Object.fromEntries(
        WEEK_DAYS.map((day) => [day, { open: true, opens_at: "09:00", closes_at: "21:00" }]),
      ),
      monday: { open: true, opens_at: "21:00", closes_at: "09:00" },
    });
    expect(storeSettingsSchema.safeParse(baseInput({ hoursJson: badHours })).success).toBe(false);
    expect(storeSettingsSchema.safeParse(baseInput({ hoursJson: "nope" })).success).toBe(false);
  });

  it("rejects non-http social URLs and caps extras", () => {
    const bad = JSON.stringify({ instagram: "ftp://example.com/x" });
    expect(storeSettingsSchema.safeParse(baseInput({ socialsJson: bad })).success).toBe(false);

    const many = JSON.stringify({
      extra: Array.from({ length: 7 }, (_, index) => ({
        label: `P${index}`,
        url: "https://example.com",
      })),
    });
    expect(storeSettingsSchema.safeParse(baseInput({ socialsJson: many })).success).toBe(false);
  });

  it("enforces the currency code shape", () => {
    expect(storeSettingsSchema.safeParse(baseInput({ currency: "INRR" })).success).toBe(false);
    expect(storeSettingsSchema.safeParse(baseInput({ currency: "in" })).success).toBe(false);
  });

  it("treats a missing favicon flag as keep (no separate favicon upload)", () => {
    // The settings form no longer submits faviconRemoved; formDataToObject
    // delivers "" for absent fields, which must not fail validation.
    const empty = storeSettingsSchema.safeParse(baseInput({ faviconRemoved: "" }));
    expect(empty.success).toBe(true);
    if (empty.success) expect(empty.data.faviconRemoved).toBe("0");

    const withoutFlag: Record<string, unknown> = { ...baseInput() };
    delete withoutFlag.faviconRemoved;
    const missing = storeSettingsSchema.safeParse(withoutFlag);
    expect(missing.success).toBe(true);
    if (missing.success) expect(missing.data.faviconRemoved).toBe("0");
  });

  it("keeps stored About content when aboutJson is absent", () => {
    const result = storeSettingsSchema.safeParse(baseInput({ aboutJson: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.aboutJson).toEqual({ keep: true });
  });

  it("accepts a complete About document and normalises the CTA", () => {
    const result = storeSettingsSchema.safeParse(
      baseInput({
        aboutJson: JSON.stringify({
          enabled: true,
          eyebrow: "Hello",
          heading: "Our bakery",
          body: "Fresh daily.",
          secondary: "",
          cta_label: "Shop",
          cta_href: "",
          banner: "cupcakes",
        }),
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.aboutJson).toEqual({
      keep: false,
      data: expect.objectContaining({ banner: "cupcakes", cta_href: "/shop" }),
    });
  });

  it("rejects bad About banner keys, links and empty essentials", () => {
    const doc = {
      enabled: true,
      eyebrow: "Hello",
      heading: "Our bakery",
      body: "Fresh daily.",
      secondary: "",
      cta_label: "Shop",
      cta_href: "/shop",
      banner: "cupcakes",
    };
    expect(
      storeSettingsSchema.safeParse(
        baseInput({ aboutJson: JSON.stringify({ ...doc, banner: "nope" }) }),
      ).success,
    ).toBe(false);
    expect(
      storeSettingsSchema.safeParse(
        baseInput({ aboutJson: JSON.stringify({ ...doc, cta_href: "javascript:x" }) }),
      ).success,
    ).toBe(false);
    expect(
      storeSettingsSchema.safeParse(
        baseInput({ aboutJson: JSON.stringify({ ...doc, heading: "  " }) }),
      ).success,
    ).toBe(false);
    expect(storeSettingsSchema.safeParse(baseInput({ aboutJson: "not json" })).success).toBe(false);
  });
});
