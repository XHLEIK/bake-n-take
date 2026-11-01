import { describe, expect, it } from "vitest";

import {
  isPromotionStatus,
  isPromotionType,
  mapAppliedPromotion,
  mapCartQuote,
  mapPromotion,
  mapPromotionCoupon,
  mapPromotionTarget,
  EMPTY_QUOTE,
} from "./types";

describe("mapPromotion", () => {
  it("maps a full row", () => {
    const promotion = mapPromotion({
      id: "p1",
      name: "Diwali 10",
      type: "percentage",
      status: "active",
      priority: 200,
      is_exclusive: true,
      is_stackable: false,
      auto_apply: true,
      repeatable: true,
      starts_at: "2026-11-01T04:30:00.000Z",
      ends_at: null,
      min_order_paise: 50000,
      max_discount_paise: 20000,
      max_uses_global: 100,
      max_uses_per_customer: 1,
      uses_count: 3,
      config: { percent: 10 },
      banner_header: "SALE",
      banner_title: "10% off",
      banner_description: null,
      banner_cta_label: "Shop",
      banner_style: "ember",
      banner_image_path: null,
      dest_type: "store",
      dest_category_id: null,
      dest_product_id: null,
      created_at: null,
      updated_at: null,
    });
    expect(promotion).toMatchObject({
      id: "p1",
      type: "percentage",
      priority: 200,
      isExclusive: true,
      minOrderPaise: 50000,
      config: { percent: 10 },
    });
  });

  it("fails closed on unknown type/status", () => {
    expect(mapPromotion({ id: "p1", type: "mystery", status: "active" })).toBe(null);
    expect(mapPromotion({ id: "p1", type: "percentage", status: "live" })).toBe(null);
    expect(mapPromotion(null)).toBe(null);
  });
});

describe("type guards", () => {
  it("accepts only known values", () => {
    expect(isPromotionType("mix_match")).toBe(true);
    expect(isPromotionType("coupon")).toBe(false);
    expect(isPromotionStatus("paused")).toBe(true);
    expect(isPromotionStatus("scheduled")).toBe(false);
  });
});

describe("mapPromotionTarget / mapPromotionCoupon", () => {
  it("maps rows and rejects bad shapes", () => {
    expect(
      mapPromotionTarget({ id: "t1", target_type: "product", target_role: "reward" }),
    ).toMatchObject({ targetType: "product", targetRole: "reward" });
    expect(mapPromotionTarget({ id: "t1", target_type: "store" })).toBe(null);
    expect(mapPromotionCoupon({ id: "c1", code: "SAVE20" })).toMatchObject({ code: "SAVE20" });
    expect(mapPromotionCoupon({ id: "c1" })).toBe(null);
  });
});

describe("mapAppliedPromotion", () => {
  it("maps engine entries and drops garbage", () => {
    expect(
      mapAppliedPromotion({
        promotion_id: "p1",
        name: "N",
        type: "percentage",
        amount: 500,
        coupon_code: "C",
      }),
    ).toMatchObject({ promotionId: "p1", amountPaise: 500, couponCode: "C" });
    expect(mapAppliedPromotion({ name: "N" })).toBe(null);
  });
});

describe("mapCartQuote", () => {
  it("maps a full engine breakdown", () => {
    const quote = mapCartQuote({
      subtotal: 120000,
      item_discount_total: 20000,
      order_discount_total: 10000,
      discount_total: 30000,
      payable: 90000,
      coupon: { code: "SAVE20", valid: true, message: "Coupon applied." },
      applied: [{ promotion_id: "p1", name: "N", type: "percentage", amount: 10000 }],
      lines: [
        { idx: 1, product_id: "prod", quantity: 2, unit_price_paise: 60000, discount_paise: 0 },
      ],
    });
    expect(quote).toMatchObject({
      subtotalPaise: 120000,
      discountTotalPaise: 30000,
      payablePaise: 90000,
      coupon: { code: "SAVE20", valid: true },
    });
    expect(quote.applied).toHaveLength(1);
    expect(quote.lines).toHaveLength(1);
  });

  it("fails closed to EMPTY_QUOTE on garbage", () => {
    expect(mapCartQuote(null)).toEqual(EMPTY_QUOTE);
    expect(mapCartQuote({ subtotal: "lots" })).toEqual(EMPTY_QUOTE);
  });
});
