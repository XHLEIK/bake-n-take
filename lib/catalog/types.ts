/**
 * Catalog application model (Phase 3).
 *
 * Money is integer paise everywhere — never floats. Slugs are the public URL
 * identity; internal UUIDs never appear in customer URLs. Availability is two
 * flags: archived rows vanish from the catalog, inactive rows show marked
 * unavailable.
 */

export type VariantMode = "none" | "size" | "quantity";

/** Name-only grouping managed from the Products area. Deleting one nulls its products. */
export type Category = {
  id: string;
  name: string;
  slug: string;
  updatedAt: string | null;
  /** Owner list views only. */
  productCount?: number;
};

export type ProductImage = {
  id: string;
  storagePath: string;
  altText: string;
  displayOrder: number;
  isPrimary: boolean;
};

export type ProductVariant = {
  id: string;
  label: string;
  value: string | null;
  /** Authoritative price in paise. */
  pricePaise: number;
  isActive: boolean;
  displayOrder: number;
};

export type ProductFlavour = {
  id: string;
  name: string;
  /** Authoritative surcharge in paise. */
  surchargePaise: number;
  isActive: boolean;
  displayOrder: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  /** Authoritative base price in paise (used when no variant applies). */
  basePricePaise: number;
  /** Null = uncategorized (shows under All until reassigned). */
  categoryId: string | null;
  categoryName: string;
  categorySlug: string;
  variantMode: VariantMode;
  isActive: boolean;
  archivedAt: string | null;
  isFeatured: boolean;
  isTrending: boolean;
  /** New-arrival merchandising (Phase 5.1): automatic hero eligibility. */
  isNew: boolean;
  newUntil: string | null;
  /** Managed hero row exists while true (Phase 5.1). */
  heroFeatured: boolean;
  allowCustomDesign: boolean;
  eggEgglessEnabled: boolean;
  egglessSurchargePaise: number;
  messageEnabled: boolean;
  /** Minimum preparation lead time in whole minutes (0 = ready now). */
  minPrepMinutes: number;
  displayOrder: number;
  updatedAt: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  flavours: ProductFlavour[];
};

export type ProductCard = Pick<
  Product,
  | "id"
  | "slug"
  | "name"
  | "shortDescription"
  | "basePricePaise"
  | "categoryName"
  | "categorySlug"
  | "variantMode"
  | "isActive"
  | "isFeatured"
  | "isTrending"
  | "allowCustomDesign"
  | "displayOrder"
> & {
  primaryImagePath: string | null;
  primaryImageAlt: string;
  /** Lowest active variant price, or the base price when no variants apply. */
  fromPricePaise: number;
  hasVariants: boolean;
};

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : null;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function paise(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function isVariantMode(value: unknown): value is VariantMode {
  return value === "none" || value === "size" || value === "quantity";
}

function prepMinutes(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 43200
    ? value
    : 720;
}

function sortByOrder<T extends { displayOrder: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function mapCategory(row: Row | null | undefined): Category | null {
  if (!row || typeof row !== "object") return null;
  const name = text(row.name);
  const slug = text(row.slug);
  if (typeof row.id !== "string" || !name || !slug) return null;
  return {
    id: row.id,
    name,
    slug,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    productCount: typeof row.productCount === "number" ? row.productCount : undefined,
  };
}

function mapImage(row: Row): ProductImage | null {
  if (typeof row.id !== "string") return null;
  const storagePath = nullableText(row.storage_path);
  if (!storagePath) return null;
  return {
    id: row.id,
    storagePath,
    altText: text(row.alt_text),
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
    isPrimary: flag(row.is_primary, false),
  };
}

function mapVariant(row: Row): ProductVariant | null {
  if (typeof row.id !== "string") return null;
  const label = text(row.label);
  if (!label) return null;
  return {
    id: row.id,
    label,
    value: nullableText(row.value),
    pricePaise: paise(row.price_paise, -1) === -1 ? -1 : paise(row.price_paise),
    isActive: flag(row.is_active, true),
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
  };
}

function mapFlavour(row: Row): ProductFlavour | null {
  if (typeof row.id !== "string") return null;
  const name = text(row.name);
  if (!name) return null;
  return {
    id: row.id,
    name,
    surchargePaise: paise(row.surcharge_paise),
    isActive: flag(row.is_active, true),
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
  };
}

function mapChildren<T>(value: unknown, map: (row: Row) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const rows: T[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const mapped = map(entry as Row);
      if (mapped) rows.push(mapped);
    }
  }
  return rows;
}

/**
 * Maps a product row with joined children (images, variants, flavours) and
 * joined category/type names. Unknown values fail closed (variant with a bad
 * price is dropped, never guessed). Never throws.
 */
export function mapProduct(row: Row | null | undefined): Product | null {
  if (!row || typeof row !== "object") return null;
  const name = text(row.name);
  const slug = text(row.slug);
  if (typeof row.id !== "string" || !name || !slug) return null;
  const categoryId = typeof row.category_id === "string" ? row.category_id : null;

  const variants = sortByOrder(mapChildren(row.product_variants, mapVariant)).filter(
    (variant) => variant.pricePaise >= 0,
  );

  return {
    id: row.id,
    slug,
    name,
    shortDescription: text(row.short_description),
    description: text(row.description),
    basePricePaise: paise(row.base_price_paise),
    categoryId,
    categoryName: text((row.categories as Row | undefined)?.name ?? row.category_name),
    categorySlug: text((row.categories as Row | undefined)?.slug ?? row.category_slug),
    variantMode: isVariantMode(row.variant_mode) ? row.variant_mode : "none",
    isActive: flag(row.is_active, true),
    archivedAt: typeof row.archived_at === "string" ? row.archived_at : null,
    isFeatured: flag(row.is_featured, false),
    isTrending: flag(row.is_trending, false),
    isNew: flag(row.is_new, false),
    newUntil: typeof row.new_until === "string" ? row.new_until : null,
    heroFeatured: flag(row.hero_featured, false),
    allowCustomDesign: flag(row.allow_custom_design, false),
    eggEgglessEnabled: flag(row.egg_eggless_enabled, false),
    egglessSurchargePaise: paise(row.eggless_surcharge_paise),
    messageEnabled: flag(row.message_enabled, false),
    minPrepMinutes: prepMinutes(row.min_prep_minutes),
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    images: sortByOrder(mapChildren(row.product_images, mapImage)),
    variants,
    flavours: sortByOrder(mapChildren(row.product_flavours, mapFlavour)),
  };
}

/** Primary image first, then display order — for cards and galleries. */
export function primaryFirst(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

/** Cheapest active variant, or null when the base price applies. */
export function cheapestVariant(variants: ProductVariant[]): ProductVariant | null {
  const active = variants.filter((variant) => variant.isActive);
  if (active.length === 0) return null;
  return active.reduce((best, variant) => (variant.pricePaise < best.pricePaise ? variant : best));
}

/** Form state for the customer design upload (no order is created). */
export type DesignUploadState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Storage path of the staged draft (private bucket), on success. */
  path?: string;
};

export const INITIAL_DESIGN_UPLOAD_STATE: DesignUploadState = { status: "idle" };

export function toProductCard(product: Product): ProductCard {
  const ordered = primaryFirst(product.images);
  const cheapest = cheapestVariant(product.variants);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    basePricePaise: product.basePricePaise,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    variantMode: product.variantMode,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    allowCustomDesign: product.allowCustomDesign,
    displayOrder: product.displayOrder,
    primaryImagePath: ordered[0]?.storagePath ?? null,
    primaryImageAlt: ordered[0]?.altText || product.name,
    fromPricePaise: cheapest ? cheapest.pricePaise : product.basePricePaise,
    hasVariants: cheapest !== null,
  };
}
