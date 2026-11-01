import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { unstable_cache } from "next/cache";

import { supabaseConfig } from "@/lib/env";

import {
  mapCategory,
  mapProduct,
  toProductCard,
  type Category,
  type Product,
  type ProductCard,
} from "./types";

export const CATALOG_TAG = "catalog";

/**
 * Centralized catalog data layer (Phase 3).
 *
 * Component → this module → Supabase. Public reads use a key-only client
 * (anonymous RLS policies are the access rule) and are cached across requests
 * (`unstable_cache`, tag `catalog`) plus deduplicated per request. Owner
 * mutations revalidate the tag, so the storefront follows without redeploys.
 *
 * Lists join children in ONE query (no N+1): cards need the primary image and
 * the cheapest variant, detail pages need everything.
 */

const PRODUCT_JOIN = `
  *,
  categories ( name, slug ),
  product_images ( * ),
  product_variants ( * ),
  product_flavours ( * )
`;

function publicClient() {
  return createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function orderProducts(query: {
  order: (column: string, options?: Record<string, unknown>) => unknown;
}): void {
  query.order("display_order", { ascending: true });
  query.order("created_at", { ascending: false });
}

export type ProductFilters = {
  categorySlug?: string;
  search?: string;
  featured?: boolean;
  trending?: boolean;
  /** Owner views pass true to include archived rows. */
  includeArchived?: boolean;
  limit?: number;
  /**
   * Customer-facing ordering. `featured` keeps the existing database order
   * (display order, then newest). Everything else re-sorts the mapped cards
   * in JS so display prices (variant-aware `fromPricePaise`) and
   * merchandising flags decide, not raw columns.
   */
  sort?: ProductSort;
};

/**
 * Sort keys accepted on customer listing pages. Unknown `sort` query values
 * fall back to `featured` at the call site — never throw on user input.
 */
export const PRODUCT_SORTS = ["featured", "popular", "price-asc", "price-desc", "name"] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

export function parseProductSort(value: string | undefined): ProductSort {
  return (PRODUCT_SORTS as readonly string[]).includes(value ?? "")
    ? (value as ProductSort)
    : "featured";
}

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  featured: "Featured",
  popular: "Most popular",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  name: "Name: A to Z",
};

/** Pure re-sort of mapped cards; exported for unit tests. */
export function sortProductCards(cards: ProductCard[], sort: ProductSort): ProductCard[] {
  const ranked = [...cards];
  switch (sort) {
    case "price-asc":
      ranked.sort((a, b) => a.fromPricePaise - b.fromPricePaise || a.name.localeCompare(b.name));
      break;
    case "price-desc":
      ranked.sort((a, b) => b.fromPricePaise - a.fromPricePaise || a.name.localeCompare(b.name));
      break;
    case "name":
      ranked.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "popular":
      ranked.sort(
        (a, b) =>
          Number(b.isTrending) - Number(a.isTrending) ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          a.displayOrder - b.displayOrder ||
          a.name.localeCompare(b.name),
      );
      break;
    case "featured":
      break;
  }
  return ranked;
}

function applyFilters(
  query: {
    eq: (column: string, value: unknown) => unknown;
    is: (column: string, value: unknown) => unknown;
    ilike: (column: string, value: string) => unknown;
    or: (filters: string) => unknown;
    limit: (count: number) => unknown;
  },
  filters: ProductFilters,
  categoryId?: string | null,
): void {
  if (!filters.includeArchived) query.is("archived_at", null);
  if (categoryId) query.eq("category_id", categoryId);
  if (filters.featured) query.eq("is_featured", true);
  if (filters.trending) query.eq("is_trending", true);
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_,\\]/g, (char) => `\\${char}`)}%`;
    query.or(`name.ilike.${pattern},short_description.ilike.${pattern}`);
  }
  if (filters.limit) query.limit(filters.limit);
}

async function categoryIdForSlug(
  client: ReturnType<typeof publicClient>,
  slug: string,
): Promise<string | null> {
  const { data } = await client.from("categories").select("id").eq("slug", slug).maybeSingle();
  const row = data as { id?: unknown } | null;
  return typeof row?.id === "string" ? row.id : null;
}

async function fetchProducts(filters: ProductFilters): Promise<ProductCard[]> {
  try {
    const supabase = publicClient();
    let categoryId: string | null = null;
    if (filters.categorySlug) {
      categoryId = await categoryIdForSlug(supabase, filters.categorySlug);
      if (!categoryId) return [];
    }

    const query = supabase.from("products").select(PRODUCT_JOIN);
    applyFilters(query, filters, categoryId);
    orderProducts(query);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    const cards: ProductCard[] = [];
    for (const row of data) {
      const product = mapProduct(row as Record<string, unknown>);
      if (product) cards.push(toProductCard(product));
    }
    return sortProductCards(cards, filters.sort ?? "featured");
  } catch {
    return [];
  }
}

export const listProducts = cache((filters: ProductFilters = {}): Promise<ProductCard[]> => {
  const key = ["catalog-products", JSON.stringify(filters)];
  return unstable_cache(() => fetchProducts(filters), key, {
    tags: [CATALOG_TAG],
    revalidate: 600,
  })();
});

export const listCategories = cache(async (): Promise<Category[]> => {
  return unstable_cache(
    async (): Promise<Category[]> => {
      try {
        const supabase = publicClient();
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .order("name", { ascending: true });
        if (error || !Array.isArray(data)) return [];
        const rows: Category[] = [];
        for (const row of data) {
          const category = mapCategory(row as Record<string, unknown>);
          if (category) rows.push(category);
        }
        return rows;
      } catch {
        return [];
      }
    },
    ["catalog-categories"],
    { tags: [CATALOG_TAG], revalidate: 600 },
  )();
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  return unstable_cache(
    async (): Promise<Product | null> => {
      try {
        const supabase = publicClient();
        const { data, error } = await supabase
          .from("products")
          .select(PRODUCT_JOIN)
          .eq("slug", slug)
          .is("archived_at", null)
          .maybeSingle();
        if (error || !data) return null;
        return mapProduct(data as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    ["catalog-product", slug],
    { tags: [CATALOG_TAG], revalidate: 600 },
  )();
});

/** Public URL for a path in the `store-assets` bucket. */
export function catalogAssetUrl(path: string | null): string | null {
  if (!path) return null;
  const clean = path.replace(/^\/+/, "");
  return `${supabaseConfig.url.replace(/\/+$/, "")}/storage/v1/object/public/store-assets/${clean}`;
}
