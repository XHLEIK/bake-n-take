import { describe, expect, it } from "vitest";

import { collectOfferProductIds } from "./repository";

const PROMOTIONS = [
  { id: "storewide", type: "percentage" },
  { id: "cakes", type: "percentage" },
  { id: "bogo", type: "buy_x_get_y" },
] as const;

const PRODUCTS = [
  { id: "p1", categoryId: "cakes" },
  { id: "p2", categoryId: "cookies" },
  { id: "p3", categoryId: null },
];

describe("collectOfferProductIds", () => {
  it("returns empty when no campaigns are active", () => {
    expect(collectOfferProductIds([], [], PRODUCTS)).toEqual(new Set());
  });

  it("treats untargeted campaigns as store-wide", () => {
    expect(collectOfferProductIds([PROMOTIONS[0]], [], PRODUCTS)).toEqual(
      new Set(["p1", "p2", "p3"]),
    );
  });

  it("matches products through their own id or their category", () => {
    const ids = collectOfferProductIds(
      [PROMOTIONS[1]],
      [
        { promotionId: "cakes", categoryId: "cakes", productId: null, targetRole: "any" },
        { promotionId: "cakes", categoryId: null, productId: "p2", targetRole: "any" },
      ],
      PRODUCTS,
    );
    expect(ids).toEqual(new Set(["p1", "p2"]));
  });

  it("ignores reward-only legs of buy_x_get_y campaigns", () => {
    // Trigger on p1, free reward on p2: only the trigger qualifies, exactly
    // like listActivePromotionsForProduct treats it.
    const ids = collectOfferProductIds(
      [PROMOTIONS[2]],
      [
        { promotionId: "bogo", categoryId: null, productId: "p1", targetRole: "trigger" },
        { promotionId: "bogo", categoryId: null, productId: "p2", targetRole: "reward" },
      ],
      PRODUCTS,
    );
    expect(ids).toEqual(new Set(["p1"]));
  });

  it("unions overlapping campaigns without duplicates", () => {
    const ids = collectOfferProductIds(
      [PROMOTIONS[0], PROMOTIONS[1]],
      [{ promotionId: "cakes", categoryId: "cakes", productId: null, targetRole: "any" }],
      PRODUCTS,
    );
    expect(ids).toEqual(new Set(["p1", "p2", "p3"]));
  });
});
