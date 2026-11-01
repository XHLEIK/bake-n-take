import { catalogAssetUrl } from "@/lib/catalog/repository";
import { listBannerGallery, offerHref } from "@/lib/promotions/repository";
import { effectiveStatus } from "@/lib/promotions/status";
import { getStoreSettings, storeAssetUrl } from "@/lib/store/repository";
import { createClient } from "@/lib/supabase/server";

import { SAFE_FALLBACK_SLIDE, SYSTEM_SLIDES } from "./defaults";
import {
  listActiveHeroItems,
  listActiveHeroPromotions,
  listHeroCategories,
  listHeroProducts,
  type HeroCategory,
  type HeroProduct,
} from "./repository";
import type { HeroItem, HeroSlide, HeroStatus } from "./types";
import type { Promotion } from "@/lib/promotions/types";

/**
 * Hero selection engine (Phase 5.1).
 *
 * `selectHeroSlides` is PURE (unit-testable): given effective-active rows and
 * lookups, it assembles slides deterministically. `getHeroSlides` fetches the
 * batched inputs. Tier order follows the spec: owner campaigns/offers →
 * featured products → new products → categories → announcements → enabled
 * defaults → safe fallback. Within a tier: display order, priority (high
 * first), created. Products dedupe across tiers (highest tier wins).
 *
 * Validity is re-checked here on every render from live rows — saved state
 * is never trusted for availability.
 */

export const HERO_MAX_SLIDES_FALLBACK = 5;

type SelectionContext = {
  webstore: string;
  promotions: Map<string, Promotion>;
  products: Map<string, HeroProduct & { isNew: boolean; newUntil: string | null }>;
  categories: Map<string, HeroCategory>;
  gallery: string[];
  categorySlugs: Map<string, string>;
  productSlugs: Map<string, string>;
  maxSlides: number;
  now: Date;
};

function pickGallery(gallery: string[], salt: string): string | null {
  if (gallery.length === 0) return null;
  let hash = 0;
  for (const char of salt) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return gallery[hash % gallery.length];
}

function imageUrl(path: string | null): string | null {
  return storeAssetUrl(path);
}

function isLive(
  item: { status: HeroStatus; startsAt: string | null; endsAt: string | null },
  now: Date,
): boolean {
  return effectiveStatus(item.status, item.startsAt, item.endsAt, now) === "active";
}

function byManualOrder(a: HeroItem, b: HeroItem): number {
  return (
    a.displayOrder - b.displayOrder ||
    b.priority - a.priority ||
    (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
  );
}

function categoryHref(webstore: string, slug: string | null): string | null {
  return slug ? `${webstore}/shop?category=${encodeURIComponent(slug)}` : null;
}

function productHref(webstore: string, slug: string | null): string | null {
  return slug ? `${webstore}/shop/${encodeURIComponent(slug)}` : null;
}

function resolveOfferSlide(
  item: HeroItem,
  promotion: Promotion,
  ctx: SelectionContext,
): HeroSlide | null {
  const href = offerHref(promotion, ctx.webstore, {
    categorySlug: promotion.destCategoryId
      ? (ctx.categorySlugs.get(promotion.destCategoryId) ?? null)
      : null,
    productSlug: promotion.destProductId
      ? (ctx.productSlugs.get(promotion.destProductId) ?? null)
      : null,
  });
  const image =
    imageUrl(promotion.bannerImagePath) ??
    imageUrl(item.imagePath) ??
    pickGallery(ctx.gallery, promotion.id);
  if (!image) return null;
  return {
    key: `offer-${item.id}`,
    eyebrow: promotion.bannerHeader ?? "Limited offer",
    headline: item.title ?? promotion.bannerTitle ?? promotion.name,
    description: item.description ?? promotion.bannerDescription,
    cta: item.ctaLabel ?? promotion.bannerCtaLabel ?? "Shop now",
    imageUrl: image,
    href,
  };
}

function resolveProductSlide(
  item: HeroItem,
  product: HeroProduct,
  ctx: SelectionContext,
  eyebrow: string,
): HeroSlide | null {
  const href = productHref(ctx.webstore, product.slug);
  if (!href) return null;
  const image =
    imageUrl(item.imagePath) ??
    catalogAssetUrl(product.primaryImagePath) ??
    pickGallery(ctx.gallery, product.id);
  if (!image) return null;
  return {
    key: `product-${item.id}-${product.id}`,
    eyebrow,
    headline: item.title ?? product.name,
    description: item.description ?? product.shortDescription ?? null,
    cta: item.ctaLabel ?? "Shop now",
    imageUrl: image,
    href,
  };
}

function resolveCategorySlide(
  item: HeroItem,
  category: HeroCategory,
  ctx: SelectionContext,
): HeroSlide | null {
  const href = categoryHref(ctx.webstore, category.slug);
  if (!href) return null;
  const image = imageUrl(item.imagePath) ?? pickGallery(ctx.gallery, category.id);
  if (!image) return null;
  return {
    key: `category-${item.id}`,
    eyebrow: "Collection",
    headline: item.title ?? category.name,
    description: item.description,
    cta: item.ctaLabel ?? "Explore",
    imageUrl: image,
    href,
  };
}

function resolveFreeSlide(
  item: HeroItem,
  ctx: SelectionContext,
  eyebrow: string,
): HeroSlide | null {
  if (!item.title) return null;
  let href = `${ctx.webstore}/shop`;
  if (item.destType === "category") {
    const resolved = categoryHref(
      ctx.webstore,
      item.destCategoryId ? (ctx.categorySlugs.get(item.destCategoryId) ?? null) : null,
    );
    if (!resolved) return null;
    href = resolved;
  } else if (item.destType === "product") {
    const resolved = productHref(
      ctx.webstore,
      item.destProductId ? (ctx.productSlugs.get(item.destProductId) ?? null) : null,
    );
    if (!resolved) return null;
    href = resolved;
  }
  const image = imageUrl(item.imagePath) ?? pickGallery(ctx.gallery, item.id);
  if (!image) return null;
  return {
    key: `${item.type}-${item.id}`,
    eyebrow,
    headline: item.title,
    description: item.description,
    cta: item.ctaLabel ?? "Explore",
    imageUrl: image,
    href,
  };
}

/** Pure tier assembly — the unit under test. */
export function selectHeroSlides(items: HeroItem[], ctx: SelectionContext): HeroSlide[] {
  const now = ctx.now;
  const live = items.filter((item) => !item.isSystem && isLive(item, now));
  const ordered = [...live].sort(byManualOrder);
  const slides: HeroSlide[] = [];
  const seenProducts = new Set<string>();
  const push = (slide: HeroSlide | null): void => {
    if (slide && slides.length < ctx.maxSlides) slides.push(slide);
  };

  // Tier 0 — owner campaigns and featured offers.
  for (const item of ordered) {
    if (item.type !== "offer" && item.type !== "campaign") continue;
    if (item.type === "offer") {
      const promotion = item.promotionId ? ctx.promotions.get(item.promotionId) : undefined;
      if (!promotion) continue;
      push(resolveOfferSlide(item, promotion, ctx));
    } else {
      push(resolveFreeSlide(item, ctx, "From the bakery"));
    }
    if (slides.length >= ctx.maxSlides) return slides;
  }

  // Tier 1 — explicitly featured products (managed hero rows).
  for (const item of ordered) {
    if (item.type !== "product" || !item.productId) continue;
    const product = ctx.products.get(item.productId);
    if (!product) continue;
    seenProducts.add(product.id);
    push(resolveProductSlide(item, product, ctx, "Featured"));
    if (slides.length >= ctx.maxSlides) return slides;
  }

  // Tier 2 — new arrivals (automatic, no hero row needed).
  const fresh = [...ctx.products.values()]
    .filter(
      (product) =>
        !seenProducts.has(product.id) &&
        product.isNew &&
        (!product.newUntil || Date.parse(product.newUntil) > now.getTime()),
    )
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  for (const product of fresh) {
    if (slides.length >= ctx.maxSlides) return slides;
    seenProducts.add(product.id);
    const href = productHref(ctx.webstore, product.slug);
    const image = catalogAssetUrl(product.primaryImagePath) ?? pickGallery(ctx.gallery, product.id);
    if (!href || !image) continue;
    slides.push({
      key: `new-${product.id}`,
      eyebrow: "New arrival",
      headline: product.name,
      description: product.shortDescription ?? "Discover our latest addition.",
      cta: "Explore now",
      imageUrl: image,
      href,
    });
  }

  // Tier 3 — category highlights.
  for (const item of ordered) {
    if (item.type !== "category" || !item.categoryId) continue;
    const category = ctx.categories.get(item.categoryId);
    if (!category) continue;
    push(resolveCategorySlide(item, category, ctx));
    if (slides.length >= ctx.maxSlides) return slides;
  }

  // Tier 4 — announcements.
  for (const item of ordered) {
    if (item.type !== "announcement") continue;
    push(resolveFreeSlide(item, ctx, "Announcement"));
    if (slides.length >= ctx.maxSlides) return slides;
  }

  // Tier 5 — enabled default system slides.
  const defaults = items.filter((item) => item.isSystem && isLive(item, now)).sort(byManualOrder);
  for (const item of defaults) {
    if (slides.length >= ctx.maxSlides) return slides;
    if (!item.systemKey) continue;
    const content = SYSTEM_SLIDES[item.systemKey as keyof typeof SYSTEM_SLIDES] ?? null;
    if (!content) continue;
    // Owner override first, then the curated seeded photo (guaranteed in
    // storage by scripts/seed-hero-images.mjs), then live gallery entries.
    // Every branch yields an absolute URL — never a bare storage path, which
    // the browser would resolve relatively and 404.
    const image =
      imageUrl(item.imagePath) ??
      imageUrl(content.imagePath) ??
      pickGallery(ctx.gallery, item.systemKey);
    if (!image) continue;
    slides.push({
      key: `system-${item.systemKey}`,
      eyebrow: content.eyebrow,
      headline: item.title ?? content.headline,
      description: item.description ?? content.description,
      cta: item.ctaLabel ?? content.cta,
      imageUrl: image,
      href: `${ctx.webstore}${content.hrefSuffix}`,
    });
  }

  // Tier 6 — safe minimal fallback. Never empty.
  // Gallery entries are listed live from storage (guaranteed to exist), with
  // the curated seeded photo as the last resort. A null image renders as an
  // intentional solid panel — never a broken <img>.
  if (slides.length === 0) {
    slides.push({
      key: SAFE_FALLBACK_SLIDE.key,
      eyebrow: SAFE_FALLBACK_SLIDE.eyebrow,
      headline: SAFE_FALLBACK_SLIDE.headline,
      description: SAFE_FALLBACK_SLIDE.description,
      cta: SAFE_FALLBACK_SLIDE.cta,
      imageUrl:
        pickGallery(ctx.gallery, "safe-fallback") ?? imageUrl(SAFE_FALLBACK_SLIDE.imagePath),
      href: `${ctx.webstore}/shop`,
    });
  }

  return slides;
}

/**
 * Assembles the homepage hero: batched reads, then the pure selector.
 * Correctness first — no cross-request caching of eligibility.
 */
export async function getHeroSlides(webstore: string): Promise<HeroSlide[]> {
  const [items, promotions, settings, gallery] = await Promise.all([
    listActiveHeroItems(),
    listActiveHeroPromotions(),
    getStoreSettings(),
    listBannerGallery(),
  ]);

  // Source + destination lookups, batched.
  const productIds = new Set<string>();
  const categoryIds = new Set<string>();
  for (const item of items) {
    if (item.productId) productIds.add(item.productId);
    if (item.categoryId) categoryIds.add(item.categoryId);
    if (item.destProductId) productIds.add(item.destProductId);
    if (item.destCategoryId) categoryIds.add(item.destCategoryId);
  }
  for (const promotion of promotions.values()) {
    if (promotion.destProductId) productIds.add(promotion.destProductId);
    if (promotion.destCategoryId) categoryIds.add(promotion.destCategoryId);
  }
  const [products, categories] = await Promise.all([
    listHeroProducts([...productIds], { featured: true, fresh: true }),
    listHeroCategories([...categoryIds]),
  ]);

  const categorySlugs = new Map<string, string>();
  const productSlugs = new Map<string, string>();
  for (const category of categories.values()) categorySlugs.set(category.id, category.slug);
  for (const product of products.values()) productSlugs.set(product.id, product.slug);
  // Destination slugs for promos/categories outside the hero pools.
  const supabase = await createClient();
  const missingCats = [...categoryIds].filter((id) => !categorySlugs.has(id));
  const missingProds = [...productIds].filter((id) => !productSlugs.has(id));
  const [extraCats, extraProds] = await Promise.all([
    missingCats.length > 0
      ? supabase.from("categories").select("id, slug").in("id", missingCats)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    missingProds.length > 0
      ? supabase.from("products").select("id, slug").in("id", missingProds).eq("is_active", true)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  for (const row of ((extraCats as { data: unknown }).data ?? []) as Record<string, unknown>[]) {
    if (typeof row.id === "string" && typeof row.slug === "string") {
      categorySlugs.set(row.id, row.slug);
    }
  }
  for (const row of ((extraProds as { data: unknown }).data ?? []) as Record<string, unknown>[]) {
    if (typeof row.id === "string" && typeof row.slug === "string") {
      productSlugs.set(row.id, row.slug);
    }
  }

  return selectHeroSlides(items, {
    webstore,
    promotions,
    products,
    categories,
    // Gallery fallbacks must be absolute public URLs: pickGallery results
    // feed slide.imageUrl directly into <img src>, and a bare storage path
    // would resolve relatively against the page and 404.
    gallery: gallery.map((entry) => entry.url),
    categorySlugs,
    productSlugs,
    maxSlides: settings?.heroMaxSlides ?? HERO_MAX_SLIDES_FALLBACK,
    now: new Date(),
  });
}
