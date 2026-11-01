import { cache } from "react";

import type { Category } from "@/lib/catalog/types";
import { createClient } from "@/lib/supabase/server";

import { effectiveStatus } from "./status";
import {
  mapAppliedPromotion,
  mapPromotion,
  mapPromotionCoupon,
  mapPromotionTarget,
  type AppliedPromotion,
  type EffectiveStatus,
  type Promotion,
  type PromotionCoupon,
  type PromotionTarget,
  type PromotionUsage,
} from "./types";

/**
 * Promotion reads (Phase 5).
 *
 * Public surfaces only ever see effective-active campaigns (RLS enforces the
 * same predicate); owner readers sit behind requireOwner in pages/actions.
 * Pricing itself lives in evaluate_order_promotions — this module only
 * fetches campaigns, targeting, banners and usage.
 */

type Row = Record<string, unknown>;

export type OwnerOfferRow = {
  promotion: Promotion;
  effective: EffectiveStatus;
  couponCount: number;
};

export type OwnerPromotionDetail = {
  promotion: Promotion;
  effective: EffectiveStatus;
  targets: PromotionTarget[];
  coupons: PromotionCoupon[];
  usage: PromotionUsage;
};

export type OfferCatalogProduct = {
  id: string;
  name: string;
  slug: string;
};

function effectiveNow(promotion: Promotion): EffectiveStatus {
  return effectiveStatus(promotion.status, promotion.startsAt, promotion.endsAt);
}

/**
 * Resolves an offer destination to a same-app URL. Only store, category and
 * product destinations exist — arbitrary owner URLs are never honored.
 */
export function offerHref(
  promotion: Promotion,
  webstore: string,
  lookup: { categorySlug: string | null; productSlug: string | null },
): string {
  if (promotion.destType === "category" && lookup.categorySlug) {
    return `${webstore}/shop?category=${encodeURIComponent(lookup.categorySlug)}`;
  }
  if (promotion.destType === "product" && lookup.productSlug) {
    return `${webstore}/shop/${encodeURIComponent(lookup.productSlug)}`;
  }
  return `${webstore}/shop`;
}

/** Effective-active campaigns with targets, newest first. */
export const listActivePromotions = cache(async (): Promise<Promotion[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("status", "active")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);
  if (error || !Array.isArray(data)) return [];
  const now = new Date();
  return (data as Row[])
    .map(mapPromotion)
    .filter((p): p is Promotion => p !== null)
    .filter((p) => effectiveStatus(p.status, p.startsAt, p.endsAt, now) === "active");
});

/** Targets for a set of promotions (batched; safe for public display). */
export async function listPromotionTargets(
  promotionIds: string[],
): Promise<(PromotionTarget & { promotionId: string })[]> {
  if (promotionIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotion_targets")
    .select("id, promotion_id, target_type, target_role, category_id, product_id")
    .in("promotion_id", promotionIds);
  if (error || !Array.isArray(data)) return [];
  const rows = (data as (Row & { promotion_id: string })[]).filter(
    (r) => typeof r.promotion_id === "string",
  );
  const categoryIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))] as string[];
  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))] as string[];
  const [cats, prods] = await Promise.all([
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Row[] }),
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);
  const catNames = new Map(
    (((cats as { data: unknown }).data ?? []) as Row[])
      .filter((r) => typeof r.id === "string")
      .map((r) => [r.id as string, typeof r.name === "string" ? r.name : null]),
  );
  const prodNames = new Map(
    (((prods as { data: unknown }).data ?? []) as Row[])
      .filter((r) => typeof r.id === "string")
      .map((r) => [r.id as string, typeof r.name === "string" ? r.name : null]),
  );
  return rows
    .map((row) => {
      const target = mapPromotionTarget({
        ...row,
        category_name: row.category_id ? (catNames.get(row.category_id as string) ?? null) : null,
        product_name: row.product_id ? (prodNames.get(row.product_id as string) ?? null) : null,
      });
      return target ? { ...target, promotionId: row.promotion_id } : null;
    })
    .filter((t): t is PromotionTarget & { promotionId: string } => t !== null);
}

/** Active campaigns relevant to one product (names only — amounts stay server-side). */
export async function listActivePromotionsForProduct(
  productId: string,
  categoryId: string | null,
): Promise<{ name: string; couponRequired: boolean }[]> {
  const promotions = await listActivePromotions();
  if (promotions.length === 0) return [];
  const targets = await listPromotionTargets(promotions.map((p) => p.id));
  const byPromo = new Map<string, PromotionTarget[]>();
  for (const target of targets) {
    const list = byPromo.get(target.promotionId) ?? [];
    list.push(target);
    byPromo.set(target.promotionId, list);
  }
  return promotions
    .filter((promotion) => {
      const scoped = (byPromo.get(promotion.id) ?? []).filter((t) =>
        promotion.type === "buy_x_get_y" ? t.targetRole !== "reward" : true,
      );
      if (scoped.length === 0) return true;
      return scoped.some(
        (t) =>
          (t.categoryId !== null && t.categoryId === categoryId) ||
          (t.productId !== null && t.productId === productId),
      );
    })
    .map((promotion) => ({ name: promotion.name, couponRequired: promotion.hasCoupon }));
}

export type OfferTargetInput = {
  promotionId: string;
  categoryId: string | null;
  productId: string | null;
  targetRole: PromotionTarget["targetRole"];
};

export type OfferProductInput = {
  id: string;
  categoryId: string | null;
};

/**
 * Pure offer-applicability resolution (exported for unit tests).
 *
 * Same relevance rule as `listActivePromotionsForProduct`, applied
 * catalogue-wide: a campaign with no scoped targets applies store-wide
 * (every listed product qualifies); otherwise a product qualifies through
 * its own id or its category. Reward-only legs of buy_x_get_y campaigns
 * never qualify a product on their own.
 */
export function collectOfferProductIds(
  promotions: Pick<Promotion, "id" | "type">[],
  targets: OfferTargetInput[],
  products: OfferProductInput[],
): Set<string> {
  const qualified = new Set<string>();
  const byPromo = new Map<string, OfferTargetInput[]>();
  for (const target of targets) {
    const list = byPromo.get(target.promotionId) ?? [];
    list.push(target);
    byPromo.set(target.promotionId, list);
  }
  for (const promotion of promotions) {
    const scoped = (byPromo.get(promotion.id) ?? []).filter((t) =>
      promotion.type === "buy_x_get_y" ? t.targetRole !== "reward" : true,
    );
    if (scoped.length === 0) {
      for (const product of products) qualified.add(product.id);
      continue;
    }
    for (const product of products) {
      const matches = scoped.some(
        (t) =>
          (t.categoryId !== null && t.categoryId === product.categoryId) ||
          (t.productId !== null && t.productId === product.id),
      );
      if (matches) qualified.add(product.id);
    }
  }
  return qualified;
}

/**
 * IDs of listed (non-archived) products with at least one active campaign.
 * Backs the shop "Offers" toggle — intersect with the page's products.
 */
export async function listOfferProductIds(): Promise<Set<string>> {
  const promotions = await listActivePromotions();
  if (promotions.length === 0) return new Set();
  const supabase = await createClient();
  const [{ data: targetRows }, { data: productRows }] = await Promise.all([
    supabase
      .from("promotion_targets")
      .select("promotion_id, target_type, target_role, category_id, product_id")
      .in(
        "promotion_id",
        promotions.map((promotion) => promotion.id),
      ),
    supabase.from("products").select("id, category_id").is("archived_at", null),
  ]);
  const targets: OfferTargetInput[] = ((targetRows ?? []) as (Row & { promotion_id: string })[])
    .filter((row) => typeof row.promotion_id === "string")
    .map((row) => ({
      promotionId: row.promotion_id,
      categoryId: typeof row.category_id === "string" ? row.category_id : null,
      productId: typeof row.product_id === "string" ? row.product_id : null,
      targetRole:
        row.target_role === "reward" || row.target_role === "trigger" ? row.target_role : "any",
    }));
  const products: OfferProductInput[] = ((productRows ?? []) as Row[])
    .filter((row) => typeof row.id === "string")
    .map((row) => ({
      id: row.id as string,
      categoryId: typeof row.category_id === "string" ? row.category_id : null,
    }));
  return collectOfferProductIds(promotions, targets, products);
}

export type OwnerOfferFilters = {
  search?: string;
  status?: string;
  sort?: "newest" | "oldest" | "priority";
};

/** Every promotion for owners, with computed status filtering in TS. */
export async function listOwnerPromotions(
  filters: OwnerOfferFilters = {},
): Promise<OwnerOfferRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*, promotion_coupons(id)")
    .order("created_at", { ascending: filters.sort === "oldest" })
    .limit(200);
  if (error || !Array.isArray(data)) return [];
  const now = new Date();
  const search = filters.search?.trim().toLowerCase() ?? "";
  const rows = (data as Row[])
    .map((row) => {
      const promotion = mapPromotion(row);
      if (!promotion) return null;
      const coupons = Array.isArray(row.promotion_coupons) ? row.promotion_coupons.length : 0;
      return {
        promotion,
        effective: effectiveStatus(promotion.status, promotion.startsAt, promotion.endsAt, now),
        couponCount: coupons,
      };
    })
    .filter((r): r is OwnerOfferRow => r !== null);

  const byStatus =
    filters.status && filters.status !== "all"
      ? rows.filter((r) => r.effective === filters.status)
      : rows;
  const bySearch =
    search.length > 0
      ? byStatus.filter((r) => r.promotion.name.toLowerCase().includes(search))
      : byStatus;
  if (filters.sort === "priority") {
    return [...bySearch].sort((a, b) => b.promotion.priority - a.promotion.priority);
  }
  return bySearch;
}

/** Full promotion detail for the owner editor + usage aggregates. */
export async function getOwnerPromotion(id: string): Promise<OwnerPromotionDetail | null> {
  const supabase = await createClient();
  const [{ data: promo }, { data: targetRows }, { data: couponRows }] = await Promise.all([
    supabase.from("promotions").select("*").eq("id", id).maybeSingle(),
    supabase.from("promotion_targets").select("*").eq("promotion_id", id),
    supabase.from("promotion_coupons").select("*").eq("promotion_id", id).order("code"),
  ]);
  const promotion = mapPromotion(promo as Row | null);
  if (!promotion) return null;
  const [{ count: redemptionCount }, { data: sums }] = await Promise.all([
    supabase
      .from("promotion_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promotion_id", id),
    supabase.from("promotion_redemptions").select("amount_paise").eq("promotion_id", id),
  ]);
  const totalDiscountPaise = ((sums ?? []) as Row[]).reduce(
    (sum, row) => sum + (typeof row.amount_paise === "number" ? row.amount_paise : 0),
    0,
  );
  return {
    promotion,
    effective: effectiveNow(promotion),
    targets: ((targetRows ?? []) as Row[])
      .map(mapPromotionTarget)
      .filter((t): t is PromotionTarget => t !== null),
    coupons: ((couponRows ?? []) as Row[])
      .map(mapPromotionCoupon)
      .filter((c): c is PromotionCoupon => c !== null),
    usage: { redemptions: redemptionCount ?? 0, totalDiscountPaise },
  };
}

/** Previously uploaded banner images (owner gallery picker). */
export async function listBannerGallery(): Promise<{ path: string; url: string }[]> {
  const supabase = await createClient();
  const gallery: { path: string; url: string }[] = [];
  const { data: entries } = await supabase.storage.from("store-assets").list("banners", {
    limit: 50,
  });
  for (const entry of entries ?? []) {
    if (entry.name.startsWith(".")) continue;
    if (entry.id === null) {
      // Folder per promotion — descend one level.
      const { data: files } = await supabase.storage
        .from("store-assets")
        .list(`banners/${entry.name}`, { limit: 50 });
      for (const file of files ?? []) {
        if (file.id === null) continue;
        const path = `banners/${entry.name}/${file.name}`;
        const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
        gallery.push({ path, url: data.publicUrl });
        if (gallery.length >= 30) return gallery;
      }
    } else {
      const path = `banners/${entry.name}`;
      const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
      gallery.push({ path, url: data.publicUrl });
      if (gallery.length >= 30) return gallery;
    }
  }
  return gallery;
}

/** Promotion picker for the hero offer selector (owner readers only). */
export async function listPromotionOptions(): Promise<
  { id: string; name: string; status: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, name, status")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !Array.isArray(data)) return [];
  return (data as Row[])
    .filter((r) => typeof r.id === "string" && typeof r.name === "string")
    .map((r) => ({
      id: r.id as string,
      name: r.name as string,
      status: typeof r.status === "string" ? r.status : "",
    }));
}

/** Categories + active products for owner targeting and destination pickers. */ export async function listOfferCatalog(): Promise<{
  categories: Category[];
  products: OfferCatalogProduct[];
}> {
  const { listOwnerCategories } = await import("@/lib/catalog/owner-repository");
  const supabase = await createClient();
  const [categories, { data: products }] = await Promise.all([
    listOwnerCategories(),
    supabase
      .from("products")
      .select("id, name, slug")
      .is("archived_at", null)
      .order("name")
      .limit(200),
  ]);
  return {
    categories,
    products: ((products ?? []) as Row[] as { id: unknown; name: unknown; slug: unknown }[])
      .filter((p) => typeof p.id === "string" && typeof p.name === "string")
      .map((p) => ({
        id: p.id as string,
        name: p.name as string,
        slug: typeof p.slug === "string" ? p.slug : "",
      })),
  };
}

export function appliedFromBreakdown(raw: unknown): AppliedPromotion[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Row[]).map(mapAppliedPromotion).filter((a): a is AppliedPromotion => a !== null);
}
