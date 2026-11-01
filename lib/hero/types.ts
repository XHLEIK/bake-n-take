/**
 * Hero/store-highlight application model (Phase 5.1).
 *
 * Hero items are generic merchandising records referencing existing
 * promotions, products and categories — never copies. Scheduling mirrors
 * promotions (stored draft/active/paused/archived; scheduled/expired
 * derived), reusing the same helpers so both systems always agree.
 */

export const HERO_TYPES = [
  "offer",
  "product",
  "category",
  "announcement",
  "campaign",
  "system",
] as const;

export type HeroType = (typeof HERO_TYPES)[number];

export const HERO_STATUSES = ["draft", "active", "paused", "archived"] as const;

export type HeroStatus = (typeof HERO_STATUSES)[number];

export type HeroItem = {
  id: string;
  type: HeroType;
  status: HeroStatus;
  displayOrder: number;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  imagePath: string | null;
  destType: "store" | "category" | "product";
  destCategoryId: string | null;
  destProductId: string | null;
  promotionId: string | null;
  productId: string | null;
  categoryId: string | null;
  isSystem: boolean;
  systemKey: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Fully resolved slide: the single shape the carousel renders. */
export type HeroSlide = {
  key: string;
  eyebrow: string | null;
  headline: string;
  description: string | null;
  cta: string | null;
  /** Null only when storage holds no usable image at all (solid panel). */
  imageUrl: string | null;
  href: string;
};

type Row = Record<string, unknown>;

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isoDate(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isHeroType(value: unknown): value is HeroType {
  return typeof value === "string" && (HERO_TYPES as readonly string[]).includes(value);
}

export function isHeroStatus(value: unknown): value is HeroStatus {
  return typeof value === "string" && (HERO_STATUSES as readonly string[]).includes(value);
}

export function mapHeroItem(row: Row | null | undefined): HeroItem | null {
  if (!row || typeof row !== "object" || typeof row.id !== "string") return null;
  if (!isHeroType(row.type)) return null;
  if (!isHeroStatus(row.status)) return null;
  const dest = row.dest_type;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    displayOrder:
      typeof row.display_order === "number" && Number.isInteger(row.display_order)
        ? row.display_order
        : 0,
    priority:
      typeof row.priority === "number" && Number.isInteger(row.priority) ? row.priority : 100,
    startsAt: isoDate(row.starts_at),
    endsAt: isoDate(row.ends_at),
    title: nullableText(row.title),
    description: nullableText(row.description),
    ctaLabel: nullableText(row.cta_label),
    imagePath: nullableText(row.image_path),
    destType: dest === "category" || dest === "product" ? dest : "store",
    destCategoryId: typeof row.dest_category_id === "string" ? row.dest_category_id : null,
    destProductId: typeof row.dest_product_id === "string" ? row.dest_product_id : null,
    promotionId: typeof row.promotion_id === "string" ? row.promotion_id : null,
    productId: typeof row.product_id === "string" ? row.product_id : null,
    categoryId: typeof row.category_id === "string" ? row.category_id : null,
    isSystem: row.is_system === true,
    systemKey: nullableText(row.system_key),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}
