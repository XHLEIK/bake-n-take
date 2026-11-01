import { describe, expect, it } from "vitest";

import { categorySchema, productSchema } from "./validation";

function productInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Chocolate Cake",
    shortDescription: "Rich and moist.",
    description: "Baked fresh every morning.",
    basePriceRupees: "600",
    categoryId: "11111111-1111-4111-8111-111111111111",
    variantMode: "size",
    variantsJson: JSON.stringify([
      { id: "", label: "1 Pound", value: "", priceRupees: "600", isActive: true },
      { id: "", label: "2 Pound", value: "", priceRupees: "1100", isActive: true },
    ]),
    flavoursJson: JSON.stringify([
      { id: "", name: "Chocolate", surchargeRupees: "", isActive: true },
      { id: "", name: "Ferrero", surchargeRupees: "150", isActive: true },
    ]),
    isActive: "1",
    isFeatured: "1",
    isTrending: "0",
    allowCustomDesign: "1",
    eggEgglessEnabled: "1",
    egglessSurchargeRupees: "50",
    messageEnabled: "1",
    displayOrder: "3",
    ...overrides,
  };
}

describe("categorySchema", () => {
  it("accepts a name-only category", () => {
    const result = categorySchema.safeParse({ name: "Chocolate Bars" });
    expect(result.success).toBe(true);
  });

  it("requires a name", () => {
    expect(categorySchema.safeParse({ name: "  " }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "Chocolate Bars" }).success).toBe(true);
  });
});

describe("productSchema", () => {
  it("accepts a complete product and converts money to paise", () => {
    const result = productSchema.safeParse(productInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.basePriceRupees).toBe(60000);
    expect(result.data.variantsJson[1]).toMatchObject({ label: "2 Pound", priceRupees: 110000 });
    expect(result.data.flavoursJson[1]).toMatchObject({ name: "Ferrero", surchargeRupees: 15000 });
    expect(result.data.egglessSurchargeRupees).toBe(5000);
  });

  it("requires a name and accepts an empty category", () => {
    expect(productSchema.safeParse(productInput({ name: "" })).success).toBe(false);
    expect(productSchema.safeParse(productInput({ categoryId: "nope" })).success).toBe(false);
    expect(productSchema.safeParse(productInput({ categoryId: "" })).success).toBe(true);
  });

  it("rejects bad money and duplicate options", () => {
    expect(productSchema.safeParse(productInput({ basePriceRupees: "10.999" })).success).toBe(
      false,
    );
    expect(
      productSchema.safeParse(
        productInput({
          variantsJson: JSON.stringify([
            { id: "", label: "1 Pound", value: "", priceRupees: "600", isActive: true },
            { id: "", label: "1 pound", value: "", priceRupees: "700", isActive: true },
          ]),
        }),
      ).success,
    ).toBe(false);
    expect(
      productSchema.safeParse(
        productInput({
          variantsJson: JSON.stringify([
            { id: "", label: "Free", value: "", priceRupees: "0", isActive: true },
          ]),
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts JSON null ids for brand-new rows (what the form sends)", () => {
    const result = productSchema.safeParse(
      productInput({
        variantsJson: JSON.stringify([
          { id: null, label: "1 Pound", value: null, priceRupees: "600", isActive: true },
        ]),
        flavoursJson: JSON.stringify([
          { id: null, name: "Plain", surchargeRupees: "", isActive: true },
        ]),
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects malformed option payloads", () => {
    expect(productSchema.safeParse(productInput({ variantsJson: "nope" })).success).toBe(false);
    expect(
      productSchema.safeParse(
        productInput({
          flavoursJson: JSON.stringify([{ id: "", name: "", surchargeRupees: "", isActive: true }]),
        }),
      ).success,
    ).toBe(false);
  });

  it("converts preparation hours to minutes with a 12-hour blank default", () => {
    const blank = productSchema.safeParse(productInput({}));
    expect(blank.success).toBe(true);
    if (blank.success) expect(blank.data.prepHours).toBe(720);

    const explicit = productSchema.safeParse(productInput({ prepHours: "48" }));
    expect(explicit.success).toBe(true);
    if (explicit.success) expect(explicit.data.prepHours).toBe(2880);

    const ready = productSchema.safeParse(productInput({ prepHours: "0" }));
    expect(ready.success).toBe(true);
    if (ready.success) expect(ready.data.prepHours).toBe(0);

    expect(productSchema.safeParse(productInput({ prepHours: "1.5" })).success).toBe(true);
    const halfHour = productSchema.safeParse(productInput({ prepHours: "0.5" }));
    expect(halfHour.success).toBe(true);
    if (halfHour.success) expect(halfHour.data.prepHours).toBe(30);
    expect(productSchema.safeParse(productInput({ prepHours: "721" })).success).toBe(false);
    expect(productSchema.safeParse(productInput({ prepHours: "-2" })).success).toBe(false);
  });
});
