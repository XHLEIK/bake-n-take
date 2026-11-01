import { describe, expect, it } from "vitest";

import { configurationTotalPaise } from "./pricing";
import { parseProductSort, sortProductCards } from "./repository";
import { slugify, uniqueSlug } from "./slug";
import { cheapestVariant, mapCategory, mapProduct, primaryFirst, toProductCard } from "./types";

describe("slugify", () => {
  it("builds URL-safe slugs", () => {
    expect(slugify("Chocolate Truffle Cake!")).toBe("chocolate-truffle-cake");
    expect(slugify("  Red   Velvet  ")).toBe("red-velvet");
    expect(slugify("!!!")).toBe("item");
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  it("dedupes against taken slugs", () => {
    expect(uniqueSlug("Chocolate Cake", [])).toBe("chocolate-cake");
    expect(uniqueSlug("Chocolate Cake", ["chocolate-cake"])).toBe("chocolate-cake-2");
    expect(uniqueSlug("Chocolate Cake", ["Chocolate-Cake", "chocolate-cake-2"])).toBe(
      "chocolate-cake-3",
    );
  });
});

describe("configurationTotalPaise", () => {
  it("adds variant, flavour and eggless amounts in paise", () => {
    expect(
      configurationTotalPaise(60000, {
        variantPaise: 110000,
        flavourSurchargePaise: 15000,
        egglessSelected: false,
        egglessSurchargePaise: 5000,
      }),
    ).toBe(125000);
  });

  it("falls back to the base price and optional eggless surcharge", () => {
    expect(
      configurationTotalPaise(8000, {
        variantPaise: null,
        flavourSurchargePaise: 0,
        egglessSelected: true,
        egglessSurchargePaise: 2000,
      }),
    ).toBe(10000);
  });

  it("floors negatives instead of producing nonsense", () => {
    expect(
      configurationTotalPaise(-5, {
        variantPaise: null,
        flavourSurchargePaise: -10,
        egglessSelected: true,
        egglessSurchargePaise: -10,
      }),
    ).toBe(0);
  });
});

describe("mapCategory", () => {
  it("maps a row and rejects nameless rows", () => {
    expect(mapCategory({ id: "c1", name: "Cakes", slug: "cakes" })).toMatchObject({
      id: "c1",
      name: "Cakes",
      slug: "cakes",
    });
    expect(mapCategory({ id: "c1", name: "  " })).toBeNull();
    expect(mapCategory(null)).toBeNull();
  });
});

describe("mapProduct", () => {
  const row = {
    id: "p1",
    slug: "chocolate-cake",
    name: "Chocolate Cake",
    short_description: "Rich",
    base_price_paise: 60000,
    category_id: "c1",
    categories: { name: "Cakes", slug: "cakes" },
    variant_mode: "size",
    is_active: true,
    archived_at: null,
    product_images: [
      { id: "i2", storage_path: "products/p1/b.png", display_order: 1, is_primary: false },
      { id: "i1", storage_path: "products/p1/a.png", display_order: 0, is_primary: true },
    ],
    product_variants: [
      { id: "v2", label: "2 Pound", price_paise: 110000, is_active: true, display_order: 1 },
      { id: "v1", label: "1 Pound", price_paise: 60000, is_active: true, display_order: 0 },
      { id: "v0", label: "Broken", price_paise: -5, is_active: true, display_order: 2 },
    ],
    product_flavours: [{ id: "f1", name: "Ferrero", surcharge_paise: 15000, is_active: true }],
  };

  it("maps joins, sorts children and drops bad prices", () => {
    const product = mapProduct(row);
    expect(product?.categoryName).toBe("Cakes");
    expect(product?.variants.map((variant) => variant.label)).toEqual(["1 Pound", "2 Pound"]);
    expect(product?.images.map((image) => image.id)).toEqual(["i1", "i2"]);
    expect(product?.flavours[0]).toMatchObject({ name: "Ferrero", surchargePaise: 15000 });
  });

  it("rejects rows without identity and unknown modes fail safe", () => {
    expect(mapProduct({ ...row, slug: "" })).toBeNull();
    expect(mapProduct({ ...row, variant_mode: "mystery" })?.variantMode).toBe("none");
  });
});

describe("primaryFirst / cheapestVariant / toProductCard", () => {
  const product = mapProduct({
    id: "p1",
    slug: "x",
    name: "X",
    base_price_paise: 8000,
    category_id: "c1",
    categories: { name: "Cakes", slug: "cakes" },
    product_type_id: 2,
    variant_mode: "quantity",
    is_active: true,
    product_images: [{ id: "i1", storage_path: "p/x.png", alt_text: "", display_order: 0 }],
    product_variants: [
      { id: "v1", label: "4 pieces", price_paise: 22000, is_active: true, display_order: 0 },
    ],
    product_flavours: [],
  });

  it("builds cards with primary image and from-prices", () => {
    if (!product) throw new Error("fixture failed");
    expect(primaryFirst(product.images)[0].id).toBe("i1");
    expect(cheapestVariant(product.variants)?.label).toBe("4 pieces");
    expect(cheapestVariant([])).toBeNull();
    const card = toProductCard(product);
    expect(card.fromPricePaise).toBe(22000);
    expect(card.hasVariants).toBe(true);
    expect(card.primaryImagePath).toBe("p/x.png");
  });

  it("falls back to the base price without variants", () => {
    if (!product) throw new Error("fixture failed");
    const card = toProductCard({ ...product, variants: [] });
    expect(card.fromPricePaise).toBe(8000);
    expect(card.hasVariants).toBe(false);
  });
});

describe("sortProductCards / parseProductSort", () => {
  const base = {
    category_id: "c1",
    categories: { name: "Cakes", slug: "cakes" },
    variant_mode: "none",
    is_active: true,
    display_order: 0,
    product_images: [],
    product_flavours: [],
  };

  function card(overrides: Record<string, unknown>) {
    const product = mapProduct({
      ...base,
      id: "px",
      slug: "x",
      name: "X",
      base_price_paise: 8000,
      product_variants: [],
      ...overrides,
    });
    if (!product) throw new Error("fixture failed");
    return toProductCard(product);
  }

  const cheap = card({ id: "p1", slug: "brownie", name: "Brownie", base_price_paise: 5000 });
  const pricey = card({
    id: "p2",
    slug: "cake",
    name: "Cake",
    base_price_paise: 8000,
    product_variants: [
      { id: "v1", label: "1 kg", price_paise: 22000, is_active: true, display_order: 0 },
    ],
  });
  const loved = card({
    id: "p3",
    slug: "cookie",
    name: "Cookie",
    base_price_paise: 9000,
    is_trending: true,
  });
  const picked = card({
    id: "p4",
    slug: "donut",
    name: "Donut",
    base_price_paise: 7000,
    is_featured: true,
  });

  it("sorts by display price, not base price", () => {
    // Cake's base is 8000 but its cheapest variant is 22000.
    expect(sortProductCards([pricey, cheap], "price-asc").map((row) => row.slug)).toEqual([
      "brownie",
      "cake",
    ]);
    expect(sortProductCards([cheap, pricey], "price-desc").map((row) => row.slug)).toEqual([
      "cake",
      "brownie",
    ]);
  });

  it("ranks trending, then featured, then catalogue order for popular", () => {
    const ranked = sortProductCards([cheap, picked, pricey, loved], "popular").map(
      (row) => row.slug,
    );
    expect(ranked).toEqual(["cookie", "donut", "brownie", "cake"]);
  });

  it("sorts names alphabetically and keeps featured order untouched", () => {
    const input = [pricey, loved, cheap];
    expect(sortProductCards(input, "name").map((row) => row.slug)).toEqual([
      "brownie",
      "cake",
      "cookie",
    ]);
    expect(sortProductCards(input, "featured")).toEqual(input);
  });

  it("falls back to featured for missing or unknown sort values", () => {
    expect(parseProductSort(undefined)).toBe("featured");
    expect(parseProductSort("price-asc")).toBe("price-asc");
    expect(parseProductSort("expensive-first")).toBe("featured");
  });
});
