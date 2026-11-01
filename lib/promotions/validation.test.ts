import { describe, expect, it } from "vitest";

import {
  isValidCouponCode,
  isoToIstLocal,
  istLocalToIso,
  normalizeCouponCode,
  parseCouponLines,
  promotionFormSchema,
  rupeesToPaise,
} from "./validation";

describe("coupon codes", () => {
  it("normalizes to uppercase without whitespace", () => {
    expect(normalizeCouponCode("  summer50\n")).toBe("SUMMER50");
    expect(isValidCouponCode("cake20")).toBe(true);
    expect(isValidCouponCode("CAKE-20")).toBe(false);
    expect(isValidCouponCode("AB")).toBe(false);
    expect(isValidCouponCode("A".repeat(25))).toBe(false);
  });

  it("splits textarea lines into valid codes and rejects", () => {
    const parsed = parseCouponLines("SUMMER50\nbad-code!\n\nCAKE20\nsummer50\n");
    expect(parsed.valid).toEqual(["SUMMER50", "CAKE20"]);
    expect(parsed.invalid).toEqual(["bad-code!"]);
  });
});

describe("money inputs", () => {
  it("converts rupees to integer paise exactly", () => {
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise(10.5)).toBe(1050);
    expect(rupeesToPaise(0)).toBe(0);
    expect(rupeesToPaise(-1)).toBe(null);
    expect(rupeesToPaise(1.005)).toBe(null);
    expect(rupeesToPaise(Number.NaN)).toBe(null);
  });
});

describe("IST schedule inputs", () => {
  it("interprets datetime-local as Asia/Kolkata wall time", () => {
    // 10:00 IST == 04:30 UTC (fixed +05:30, no DST).
    expect(istLocalToIso("2026-11-01T10:00")).toBe("2026-11-01T04:30:00.000Z");
    expect(istLocalToIso("")).toBe(null);
    expect(istLocalToIso("2026-13-99T99:99")).toBe(null);
    expect(istLocalToIso("not-a-date")).toBe(null);
  });

  it("round-trips stored instants back to IST wall time", () => {
    expect(isoToIstLocal("2026-11-01T04:30:00.000Z")).toBe("2026-11-01T10:00");
    expect(isoToIstLocal(null)).toBe("");
    expect(isoToIstLocal("garbage")).toBe("");
  });
});

function baseForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Diwali Treat",
    type: "percentage",
    priority: "normal",
    isExclusive: "",
    isStackable: "",
    autoApply: "on",
    repeatable: "",
    startsAt: "",
    endsAt: "",
    minOrderRupees: "",
    maxDiscountRupees: "",
    maxUsesGlobal: "",
    maxUsesPerCustomer: "",
    percent: "10",
    buyQty: "2",
    rewardQty: "1",
    rewardKind: "free",
    rewardPercent: "50",
    rewardPriceRupees: "",
    bundleQty: "4",
    bundlePriceRupees: "",
    foKind: "fixed",
    foValue: "",
    categoryIds: "",
    productIds: "",
    triggerCategoryIds: "",
    triggerProductIds: "",
    rewardCategoryIds: "",
    rewardProductIds: "",
    couponsText: "",
    bannerHeader: "",
    bannerTitle: "",
    bannerDescription: "",
    bannerCtaLabel: "",
    bannerStyle: "ember",
    removeBannerImage: "",
    galleryImagePath: "",
    destType: "store",
    destCategoryId: "",
    destProductId: "",
    ...overrides,
  };
}

describe("promotionFormSchema", () => {
  it("accepts a valid percentage offer", () => {
    const result = promotionFormSchema.safeParse(baseForm());
    expect(result.success).toBe(true);
  });

  it("maps simple priorities to numbers", () => {
    const high = promotionFormSchema.safeParse(baseForm({ priority: "high" }));
    const low = promotionFormSchema.safeParse(baseForm({ priority: "low" }));
    expect(high.success && high.data.priority).toBe(300);
    expect(low.success && low.data.priority).toBe(10);
    expect(promotionFormSchema.safeParse(baseForm({ priority: "urgent" })).success).toBe(false);
  });

  it("rejects out-of-range percents", () => {
    expect(promotionFormSchema.safeParse(baseForm({ percent: "0" })).success).toBe(false);
    expect(promotionFormSchema.safeParse(baseForm({ percent: "101" })).success).toBe(false);
  });

  it("rejects coupon codes combined with automatic application", () => {
    const result = promotionFormSchema.safeParse(
      baseForm({ couponsText: "SAVE20", autoApply: "on" }),
    );
    expect(result.success).toBe(false);
  });

  it("requires codes for code-only offers", () => {
    const result = promotionFormSchema.safeParse(baseForm({ autoApply: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = promotionFormSchema.safeParse(
      baseForm({ startsAt: "2026-11-10T10:00", endsAt: "2026-11-01T10:00" }),
    );
    expect(result.success).toBe(false);
  });

  it("validates buy-x-get-y quantities", () => {
    const result = promotionFormSchema.safeParse(baseForm({ type: "buy_x_get_y", buyQty: "0" }));
    expect(result.success).toBe(false);
    expect(
      promotionFormSchema.safeParse(baseForm({ type: "buy_x_get_y", buyQty: "2", rewardQty: "1" }))
        .success,
    ).toBe(true);
  });

  it("requires bundle sizes of at least two", () => {
    const result = promotionFormSchema.safeParse(
      baseForm({ type: "mix_match", bundleQty: "1", bundlePriceRupees: "199" }),
    );
    expect(result.success).toBe(false);
  });

  it("requires a destination reference for category/product banners", () => {
    expect(promotionFormSchema.safeParse(baseForm({ destType: "category" })).success).toBe(false);
    expect(
      promotionFormSchema.safeParse(
        baseForm({
          destType: "category",
          destCategoryId: "11111111-1111-4111-8111-111111111111",
        }),
      ).success,
    ).toBe(true);
  });
});
