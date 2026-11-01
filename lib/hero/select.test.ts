import { describe, expect, it } from "vitest";

import { selectHeroSlides } from "./select";
import type { HeroItem } from "./types";
import type { Promotion } from "@/lib/promotions/types";
import type { HeroCategory, HeroProduct } from "./repository";

const NOW = new Date("2026-09-25T12:00:00.000Z");
const WEBSTORE = "/webstore/u1";

type FullProduct = HeroProduct & { isNew: boolean; newUntil: string | null };

function item(overrides: Partial<HeroItem> = {}): HeroItem {
  return {
    id: "h1",
    type: "announcement",
    status: "active",
    displayOrder: 0,
    priority: 100,
    startsAt: null,
    endsAt: null,
    title: "Hello",
    description: null,
    ctaLabel: null,
    imagePath: null,
    destType: "store",
    destCategoryId: null,
    destProductId: null,
    promotionId: null,
    productId: null,
    categoryId: null,
    isSystem: false,
    systemKey: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

function product(overrides: Partial<FullProduct> = {}): FullProduct {
  return {
    id: "p1",
    name: "Chocolate Cake",
    slug: "chocolate-cake",
    shortDescription: "Rich.",
    categoryId: "c1",
    primaryImagePath: "products/p1/a.jpg",
    updatedAt: "2026-09-20T00:00:00.000Z",
    isNew: false,
    newUntil: null,
    ...overrides,
  };
}

function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo1",
    name: "Diwali 10",
    type: "percentage",
    status: "active",
    priority: 100,
    isExclusive: false,
    isStackable: false,
    autoApply: true,
    repeatable: false,
    startsAt: null,
    endsAt: null,
    minOrderPaise: 0,
    maxDiscountPaise: null,
    maxUsesGlobal: null,
    maxUsesPerCustomer: null,
    usesCount: 0,
    hasCoupon: false,
    config: { percent: 10 },
    bannerHeader: null,
    bannerTitle: "Diwali 10% off",
    bannerDescription: null,
    bannerCtaLabel: null,
    bannerStyle: "ember",
    bannerImagePath: "banners/promo.jpg",
    destType: "store",
    destCategoryId: null,
    destProductId: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function ctx(
  overrides: Partial<Parameters<typeof selectHeroSlides>[1]> = {},
): Parameters<typeof selectHeroSlides>[1] {
  return {
    webstore: WEBSTORE,
    promotions: new Map(),
    products: new Map(),
    categories: new Map(),
    gallery: ["banners/g.jpg"],
    categorySlugs: new Map(),
    productSlugs: new Map(),
    maxSlides: 5,
    now: NOW,
    ...overrides,
  };
}

describe("selectHeroSlides", () => {
  it("never returns empty: safe fallback when nothing qualifies", () => {
    const slides = selectHeroSlides([], ctx({ gallery: [] }));
    expect(slides.length).toBe(1);
    expect(slides[0].key).toBe("safe-fallback");
    expect(slides[0].href).toBe(`${WEBSTORE}/shop`);
  });

  it("shows enabled defaults in manual order when nothing else exists", () => {
    const slides = selectHeroSlides(
      [
        item({
          id: "s2",
          type: "system",
          isSystem: true,
          systemKey: "default_2",
          displayOrder: 2,
          title: null,
        }),
        item({
          id: "s1",
          type: "system",
          isSystem: true,
          systemKey: "default_1",
          displayOrder: 1,
          title: null,
        }),
      ],
      ctx(),
    );
    expect(slides.map((s) => s.key)).toEqual(["system-default_1", "system-default_2"]);
    expect(slides[0].headline).toBe("Freshly Baked, Made for You");
  });

  it("skips paused system slides but keeps the rest", () => {
    const slides = selectHeroSlides(
      [
        item({
          id: "s1",
          type: "system",
          isSystem: true,
          systemKey: "default_1",
          status: "paused",
          displayOrder: 1,
          title: null,
        }),
        item({
          id: "s3",
          type: "system",
          isSystem: true,
          systemKey: "default_3",
          displayOrder: 3,
          title: null,
        }),
      ],
      ctx(),
    );
    expect(slides.map((s) => s.key)).toEqual(["system-default_3"]);
  });

  it("excludes scheduled and expired rows", () => {
    const slides = selectHeroSlides(
      [
        item({ id: "future", startsAt: "2026-10-01T04:30:00.000Z" }),
        item({ id: "past", endsAt: "2026-09-01T04:30:00.000Z" }),
      ],
      ctx({ gallery: [] }),
    );
    // Both excluded → safe fallback only.
    expect(slides.map((s) => s.key)).toEqual(["safe-fallback"]);
  });

  it("orders tiers: offer first, then featured, new, category, announcement", () => {
    const promos = new Map([["promo1", promotion()]]);
    const products = new Map([
      ["p1", product({ id: "p1" })],
      ["p2", product({ id: "p2", name: "New Tart", slug: "new-tart", isNew: true })],
    ]);
    const categories = new Map([["c1", { id: "c1", name: "Cakes", slug: "cakes" }]]);
    const slides = selectHeroSlides(
      [
        item({ id: "a1", type: "announcement", displayOrder: 0, title: "News" }),
        item({ id: "c1", type: "category", displayOrder: 0, categoryId: "c1", title: "Cakes" }),
        item({ id: "f1", type: "product", displayOrder: 0, productId: "p1", title: "Star cake" }),
        item({ id: "o1", type: "offer", displayOrder: 0, promotionId: "promo1" }),
      ],
      ctx({
        promotions: promos,
        products,
        categories,
        categorySlugs: new Map([["c1", "cakes"]]),
        productSlugs: new Map([
          ["p1", "chocolate-cake"],
          ["p2", "new-tart"],
        ]),
      }),
    );
    expect(slides.map((s) => s.key)).toEqual([
      "offer-o1",
      "product-f1-p1",
      "new-p2",
      "category-c1",
      "announcement-a1",
    ]);
  });

  it("dedupes a product featured and new into one slide", () => {
    const products = new Map([["p1", product({ id: "p1", isNew: true })]]);
    const slides = selectHeroSlides(
      [item({ id: "f1", type: "product", productId: "p1", title: "Star" })],
      ctx({ products, productSlugs: new Map([["p1", "chocolate-cake"]]) }),
    );
    expect(slides.map((s) => s.key)).toEqual(["product-f1-p1"]);
  });

  it("drops offer slides whose promotion vanished", () => {
    const slides = selectHeroSlides(
      [item({ id: "o1", type: "offer", promotionId: "gone" })],
      ctx({ gallery: [] }),
    );
    expect(slides.map((s) => s.key)).toEqual(["safe-fallback"]);
  });

  it("drops slides with invalid destinations", () => {
    const slides = selectHeroSlides(
      [
        item({
          id: "a1",
          type: "announcement",
          title: "News",
          destType: "category",
          destCategoryId: "deleted",
        }),
      ],
      ctx({ gallery: [] }),
    );
    expect(slides.map((s) => s.key)).toEqual(["safe-fallback"]);
  });

  it("caps slides at the configured maximum", () => {
    const slides = selectHeroSlides(
      [
        item({ id: "a1", title: "One", displayOrder: 1 }),
        item({ id: "a2", title: "Two", displayOrder: 2 }),
        item({ id: "a3", title: "Three", displayOrder: 3 }),
      ],
      ctx({ maxSlides: 2 }),
    );
    expect(slides).toHaveLength(2);
  });

  it("skips imageless slides in favor of lower tiers with photos", () => {
    const slides = selectHeroSlides(
      [
        item({ id: "a1", type: "announcement", title: "No photo", displayOrder: 0 }),
        item({
          id: "s1",
          type: "system",
          isSystem: true,
          systemKey: "default_1",
          displayOrder: 9,
          title: null,
        }),
      ],
      ctx({ gallery: [] }),
    );
    // The announcement has no usable photo, but the enabled system slide
    // resolves its curated seeded photo — no empty gallery can blank the hero.
    expect(slides.map((s) => s.key)).toEqual(["system-default_1"]);
    expect(slides[0].imageUrl).toContain("banners/predefined-chocolate-cake.jpg");
  });
});
