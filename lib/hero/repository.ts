import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { effectiveStatus } from "@/lib/promotions/status";
import type { EffectiveStatus } from "@/lib/promotions/types";
import { mapPromotion, type Promotion } from "@/lib/promotions/types";

import { mapHeroItem, type HeroItem } from "./types";

/**
 * Hero reads (Phase 5.1).
 *
 * Public surfaces only see effective-active rows (RLS agrees); owner readers
 * sit behind requireOwner. Reads are batched per render — never one query
 * per product/category/offer. Pricing/discounts are untouched here; the
 * Phase 5 engine remains authoritative for money.
 */

type Row = Record<string, unknown>;

export type HeroProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  categoryId: string | null;
  primaryImagePath: string | null;
  updatedAt: string | null;
};

export type HeroCategory = {
  id: string;
  name: string;
  slug: string;
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Effective-active hero rows, ordered for deterministic selection. */
export const listActiveHeroItems = cache(async (): Promise<HeroItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_items")
    .select("*")
    .eq("status", "active")
    .order("display_order")
    .order("priority", { ascending: false })
    .order("created_at")
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  const now = new Date();
  return (data as Row[])
    .map(mapHeroItem)
    .filter((item): item is HeroItem => item !== null)
    .filter((item) => effectiveStatus(item.status, item.startsAt, item.endsAt, now) === "active");
});

/** Effective-active promotions keyed by id (offer slide sources). */
export async function listActiveHeroPromotions(): Promise<Map<string, Promotion>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("status", "active")
    .limit(100);
  if (error || !Array.isArray(data)) return new Map();
  const now = new Date();
  const map = new Map<string, Promotion>();
  for (const row of (data as Row[]).map(mapPromotion)) {
    if (!row) continue;
    if (effectiveStatus(row.status, row.startsAt, row.endsAt, now) !== "active") continue;
    map.set(row.id, row);
  }
  return map;
}

function mapHeroProduct(row: Row, primaryImage: string | null): HeroProduct | null {
  if (typeof row.id !== "string" || typeof row.slug !== "string") return null;
  return {
    id: row.id,
    name: text(row.name),
    slug: row.slug,
    shortDescription: text(row.short_description),
    categoryId: typeof row.category_id === "string" ? row.category_id : null,
    primaryImagePath: primaryImage,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/** Live catalog products for the given ids + featured/new merchandising pools. */
export async function listHeroProducts(
  ids: string[],
  pools: { featured: boolean; fresh: boolean },
): Promise<Map<string, HeroProduct & { isNew: boolean; newUntil: string | null }>> {
  const supabase = await createClient();
  type ProductRow = Row & {
    is_new?: unknown;
    new_until?: unknown;
    hero_featured?: unknown;
  };
  let query = supabase
    .from("products")
    .select(
      "id, name, slug, short_description, category_id, is_active, archived_at, is_new, new_until, hero_featured, updated_at",
    )
    .is("archived_at", null)
    .eq("is_active", true);
  const orParts: string[] = [];
  if (ids.length > 0) orParts.push(`id.in.(${ids.join(",")})`);
  if (pools.featured) orParts.push("hero_featured.eq.true");
  if (pools.fresh) orParts.push("is_new.eq.true");
  if (orParts.length === 0) return new Map();
  query = query.or(orParts.join(","));
  const { data, error } = await query.limit(100);
  if (error || !Array.isArray(data)) return new Map();
  const rows = (data as ProductRow[]).filter((r) => typeof r.id === "string");
  const { data: images } = await supabase
    .from("product_images")
    .select("product_id, storage_path, is_primary, display_order")
    .in(
      "product_id",
      rows.map((r) => r.id as string),
    )
    .order("is_primary", { ascending: false })
    .order("display_order");
  const primary = new Map<string, string>();
  for (const img of (images ?? []) as Row[]) {
    if (typeof img.product_id !== "string" || typeof img.storage_path !== "string") continue;
    if (!primary.has(img.product_id)) primary.set(img.product_id, img.storage_path);
  }
  const map = new Map<string, HeroProduct & { isNew: boolean; newUntil: string | null }>();
  for (const row of rows) {
    const base = mapHeroProduct(row, primary.get(row.id as string) ?? null);
    if (!base) continue;
    map.set(base.id, {
      ...base,
      isNew: row.is_new === true,
      newUntil: typeof row.new_until === "string" ? row.new_until : null,
    });
  }
  return map;
}

/** Live categories for the given ids (deleted rows simply miss). */
export async function listHeroCategories(ids: string[]): Promise<Map<string, HeroCategory>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, is_active, archived_at")
    .in("id", unique);
  if (error || !Array.isArray(data)) return new Map();
  const map = new Map<string, HeroCategory>();
  for (const row of data as Row[]) {
    if (typeof row.id !== "string" || typeof row.slug !== "string") continue;
    if (row.archived_at != null || row.is_active !== true) continue;
    map.set(row.id, { id: row.id, name: text(row.name), slug: row.slug });
  }
  return map;
}

export type OwnerHeroFilters = {
  search?: string;
  status?: string;
  type?: string;
  sort?: "newest" | "oldest" | "ordered";
};

export type OwnerHeroRow = {
  item: HeroItem;
  effective: EffectiveStatus;
  sourceName: string | null;
};

/** Every hero row for owners, with computed-status filtering in TS. */
export async function listOwnerHeroItems(filters: OwnerHeroFilters = {}): Promise<OwnerHeroRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_items")
    .select("*")
    .order("created_at", { ascending: filters.sort === "oldest" })
    .limit(200);
  if (error || !Array.isArray(data)) return [];
  const items = (data as Row[]).map(mapHeroItem).filter((i): i is HeroItem => i !== null);
  // Source names in two batched lookups (no embedded-join name guessing).
  const promoIds = [...new Set(items.map((i) => i.promotionId).filter(Boolean))] as string[];
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
  const categoryIds = [...new Set(items.map((i) => i.categoryId).filter(Boolean))] as string[];
  const [promos, products, categories] = await Promise.all([
    promoIds.length > 0
      ? supabase.from("promotions").select("id, name").in("id", promoIds)
      : Promise.resolve({ data: [] as Row[] }),
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] as Row[] }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);
  const names = new Map<string, string>();
  for (const set of [promos, products, categories]) {
    for (const row of ((set as { data: unknown }).data ?? []) as Row[]) {
      if (typeof row.id === "string" && typeof row.name === "string") names.set(row.id, row.name);
    }
  }
  const now = new Date();
  const rows = items.map((item) => ({
    item,
    effective: effectiveStatus(item.status, item.startsAt, item.endsAt, now),
    sourceName:
      names.get(item.promotionId ?? "") ??
      names.get(item.productId ?? "") ??
      names.get(item.categoryId ?? "") ??
      null,
  }));

  const search = filters.search?.trim().toLowerCase() ?? "";
  let out = rows;
  if (filters.status && filters.status !== "all") {
    out = out.filter((r) => r.effective === filters.status);
  }
  if (filters.type && filters.type !== "all") {
    out = out.filter((r) => r.item.type === filters.type);
  }
  if (search.length > 0) {
    out = out.filter(
      (r) =>
        (r.item.title ?? "").toLowerCase().includes(search) ||
        (r.sourceName ?? "").toLowerCase().includes(search),
    );
  }
  if (!filters.sort || filters.sort === "ordered") {
    out = [...out].sort(
      (a, b) =>
        a.item.displayOrder - b.item.displayOrder ||
        b.item.priority - a.item.priority ||
        (a.item.createdAt ?? "").localeCompare(b.item.createdAt ?? ""),
    );
  }
  return out;
}

/** Full hero row for the owner editor. */
export async function getOwnerHeroItem(id: string): Promise<HeroItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("hero_items").select("*").eq("id", id).maybeSingle();
  return mapHeroItem(data as Row | null);
}
