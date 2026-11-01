import { createClient as createServerClient } from "@/lib/supabase/server";

import { mapCategory, mapProduct, type Category, type Product } from "./types";

/**
 * Owner-side catalog reads (Phase 3).
 *
 * Server-only: authenticated session client behind `requireOwner`.
 * Never import this module from client components.
 */

const PRODUCT_JOIN = `
  *,
  categories ( name, slug ),
  product_images ( * ),
  product_variants ( * ),
  product_flavours ( * )
`;

type OrderableQuery = {
  order: (column: string, options?: Record<string, unknown>) => unknown;
};

function orderProducts(query: OrderableQuery): void {
  query.order("display_order", { ascending: true });
  query.order("created_at", { ascending: false });
}

// ---------------------------------------------------------------------------
// Owner reads (authenticated session client — RLS owner policies apply).
// Only call these behind `requireOwner`.
// ---------------------------------------------------------------------------

export type OwnerProductFilters = {
  search?: string;
  categoryId?: string;
  status?: "all" | "active" | "unavailable" | "archived";
  featured?: boolean;
  trending?: boolean;
};

export async function listOwnerProducts(filters: OwnerProductFilters = {}): Promise<Product[]> {
  const supabase = await createServerClient();
  let query = supabase.from("products").select(PRODUCT_JOIN);

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_,\\]/g, (char) => `\\${char}`)}%`;
    query = query.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
  }
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.featured) query = query.eq("is_featured", true);
  if (filters.trending) query = query.eq("is_trending", true);
  switch (filters.status ?? "all") {
    case "active":
      query = query.is("archived_at", null).eq("is_active", true);
      break;
    case "unavailable":
      query = query.is("archived_at", null).eq("is_active", false);
      break;
    case "archived":
      query = query.not("archived_at", "is", null);
      break;
    default:
      break;
  }

  orderProducts(query);
  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];
  const rows: Product[] = [];
  for (const row of data) {
    const product = mapProduct(row as Record<string, unknown>);
    if (product) rows.push(product);
  }
  return rows;
}

export async function getOwnerProduct(id: string): Promise<Product | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_JOIN)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapProduct(data as Record<string, unknown>);
}

export async function listOwnerCategories(): Promise<Category[]> {
  const supabase = await createServerClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("name", { ascending: true }),
    supabase.from("products").select("category_id").is("archived_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const row of (products ?? []) as { category_id: string }[]) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  const rows: Category[] = [];
  for (const row of (categories ?? []) as Record<string, unknown>[]) {
    const category = mapCategory(row);
    if (category) {
      category.productCount = counts.get(category.id) ?? 0;
      rows.push(category);
    }
  }
  return rows;
}
