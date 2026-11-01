import { describe, expect, it } from "vitest";

import { heroFormSchema } from "./validation";

function baseForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    type: "announcement",
    displayOrder: "0",
    priority: "100",
    startsAt: "",
    endsAt: "",
    title: "Weekend treats",
    description: "",
    ctaLabel: "",
    removeImage: "",
    galleryImagePath: "",
    destType: "store",
    destCategoryId: "",
    destProductId: "",
    promotionId: "",
    productId: "",
    categoryId: "",
    ...overrides,
  };
}

describe("heroFormSchema", () => {
  it("accepts a minimal announcement", () => {
    expect(heroFormSchema.safeParse(baseForm()).success).toBe(true);
  });

  it("requires a source per type", () => {
    expect(heroFormSchema.safeParse(baseForm({ type: "offer" })).success).toBe(false);
    expect(
      heroFormSchema.safeParse(
        baseForm({ type: "offer", promotionId: "11111111-1111-4111-8111-111111111111" }),
      ).success,
    ).toBe(true);
    expect(heroFormSchema.safeParse(baseForm({ type: "product" })).success).toBe(false);
    expect(heroFormSchema.safeParse(baseForm({ type: "category" })).success).toBe(false);
  });

  it("requires a headline for free-content types", () => {
    expect(heroFormSchema.safeParse(baseForm({ title: "" })).success).toBe(false);
  });

  it("rejects system creation and bad windows", () => {
    expect(heroFormSchema.safeParse(baseForm({ type: "system" })).success).toBe(false);
    expect(
      heroFormSchema.safeParse(
        baseForm({ startsAt: "2026-11-10T10:00", endsAt: "2026-11-01T10:00" }),
      ).success,
    ).toBe(false);
  });

  it("requires destinations for free-content types", () => {
    expect(heroFormSchema.safeParse(baseForm({ destType: "category" })).success).toBe(false);
    expect(
      heroFormSchema.safeParse(
        baseForm({
          destType: "product",
          destProductId: "11111111-1111-4111-8111-111111111111",
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects malformed gallery paths", () => {
    expect(
      heroFormSchema.safeParse(baseForm({ galleryImagePath: "https://evil.example/x.jpg" }))
        .success,
    ).toBe(false);
    expect(
      heroFormSchema.safeParse(baseForm({ galleryImagePath: "banners/predefined-bread.jpg" }))
        .success,
    ).toBe(true);
  });
});
