/**
 * Promotion-system application model (Phase 5).
 *
 * Money is integer paise. The database owns pricing (evaluate_order_promotions
 * is the single calculation path); these types describe campaigns, targeting,
 * coupons, the durable redemption ledger, and quote breakdowns for display.
 * Mappers fail closed on unknown values, matching the Phase 4 convention.
 */

export const PROMOTION_TYPES = ["percentage", "buy_x_get_y", "mix_match", "first_order"] as const;

export type PromotionType = (typeof PROMOTION_TYPES)[number];

/** Stored lifecycle state. Scheduled/expired are derived (see status.ts). */
export const PROMOTION_STATUSES = ["draft", "active", "paused", "archived"] as const;

export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export type EffectiveStatus = PromotionStatus | "scheduled" | "expired";

export const BANNER_STYLES = ["ember", "honey", "cocoa", "berry", "matcha", "ocean"] as const;

export type BannerStyle = (typeof BANNER_STYLES)[number];

export const DEST_TYPES = ["store", "category", "product"] as const;

export type DestinationType = (typeof DEST_TYPES)[number];

export type PercentageConfig = {
  percent: number;
};

export type BogoConfig = {
  buy_qty: number;
  reward_qty: number;
  reward_kind: "free" | "percent" | "price";
  reward_percent: number;
  reward_price_paise: number;
};

export type MixMatchConfig = {
  bundle_qty: number;
  bundle_price_paise: number;
};

export type FirstOrderConfig = {
  kind: "percent" | "fixed";
  value: number;
};

export type PromotionConfig = PercentageConfig | BogoConfig | MixMatchConfig | FirstOrderConfig;

export type Promotion = {
  id: string;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  priority: number;
  isExclusive: boolean;
  isStackable: boolean;
  autoApply: boolean;
  repeatable: boolean;
  startsAt: string | null;
  endsAt: string | null;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  maxUsesGlobal: number | null;
  maxUsesPerCustomer: number | null;
  usesCount: number;
  /** Public hint: the promo requires a coupon code (values stay hidden). */
  hasCoupon: boolean;
  config: PromotionConfig;
  bannerHeader: string | null;
  bannerTitle: string | null;
  bannerDescription: string | null;
  bannerCtaLabel: string | null;
  bannerStyle: BannerStyle;
  bannerImagePath: string | null;
  destType: DestinationType;
  destCategoryId: string | null;
  destProductId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PromotionTarget = {
  id: string;
  targetType: "category" | "product";
  targetRole: "any" | "trigger" | "reward";
  categoryId: string | null;
  productId: string | null;
  categoryName: string | null;
  productName: string | null;
};

export type PromotionCoupon = {
  id: string;
  code: string;
  isActive: boolean;
};

export type PromotionUsage = {
  redemptions: number;
  totalDiscountPaise: number;
};

export type AppliedPromotion = {
  promotionId: string;
  name: string;
  type: string;
  amountPaise: number;
  couponCode: string | null;
};

export type QuoteLine = {
  idx: number;
  /** Cart line id (filled by the quote helper, not the engine). */
  cartItemId: string | null;
  productId: string;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
};

export type CartQuote = {
  subtotalPaise: number;
  itemDiscountPaise: number;
  orderDiscountPaise: number;
  discountTotalPaise: number;
  payablePaise: number;
  coupon: { code: string; valid: boolean; message: string } | null;
  applied: AppliedPromotion[];
  lines: QuoteLine[];
};

export const EMPTY_QUOTE: CartQuote = {
  subtotalPaise: 0,
  itemDiscountPaise: 0,
  orderDiscountPaise: 0,
  discountTotalPaise: 0,
  payablePaise: 0,
  coupon: null,
  applied: [],
  lines: [],
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function paise(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function nullablePaise(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function nullableCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

function isoDate(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isPromotionType(value: unknown): value is PromotionType {
  return typeof value === "string" && (PROMOTION_TYPES as readonly string[]).includes(value);
}

export function isPromotionStatus(value: unknown): value is PromotionStatus {
  return typeof value === "string" && (PROMOTION_STATUSES as readonly string[]).includes(value);
}

function isBannerStyle(value: unknown): value is BannerStyle {
  return typeof value === "string" && (BANNER_STYLES as readonly string[]).includes(value);
}

function isDestType(value: unknown): value is DestinationType {
  return typeof value === "string" && (DEST_TYPES as readonly string[]).includes(value);
}

function mapConfig(type: PromotionType, raw: unknown): PromotionConfig {
  const config = (raw ?? {}) as Record<string, unknown>;
  const num = (key: string): number => {
    const value = config[key];
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
  };
  switch (type) {
    case "percentage":
      return { percent: num("percent") };
    case "buy_x_get_y": {
      const kind = config["reward_kind"];
      return {
        buy_qty: num("buy_qty"),
        reward_qty: num("reward_qty"),
        reward_kind: kind === "percent" || kind === "price" ? kind : "free",
        reward_percent: num("reward_percent"),
        reward_price_paise: num("reward_price_paise"),
      };
    }
    case "mix_match":
      return { bundle_qty: num("bundle_qty"), bundle_price_paise: num("bundle_price_paise") };
    case "first_order": {
      const kind = config["kind"];
      return { kind: kind === "percent" ? "percent" : "fixed", value: num("value") };
    }
  }
}

export function mapPromotion(row: Row | null | undefined): Promotion | null {
  if (!row || typeof row !== "object" || typeof row.id !== "string") return null;
  if (!isPromotionType(row.type)) return null;
  if (!isPromotionStatus(row.status)) return null;
  return {
    id: row.id,
    name: text(row.name),
    type: row.type,
    status: row.status,
    priority:
      typeof row.priority === "number" && Number.isInteger(row.priority) ? row.priority : 100,
    isExclusive: row.is_exclusive === true,
    isStackable: row.is_stackable === true,
    autoApply: row.auto_apply !== false,
    repeatable: row.repeatable === true,
    startsAt: isoDate(row.starts_at),
    endsAt: isoDate(row.ends_at),
    minOrderPaise: paise(row.min_order_paise),
    maxDiscountPaise: nullablePaise(row.max_discount_paise),
    maxUsesGlobal: nullableCount(row.max_uses_global),
    maxUsesPerCustomer: nullableCount(row.max_uses_per_customer),
    usesCount: paise(row.uses_count),
    hasCoupon: row.has_coupon === true,
    config: mapConfig(row.type, row.config),
    bannerHeader: nullableText(row.banner_header),
    bannerTitle: nullableText(row.banner_title),
    bannerDescription: nullableText(row.banner_description),
    bannerCtaLabel: nullableText(row.banner_cta_label),
    bannerStyle: isBannerStyle(row.banner_style) ? row.banner_style : "ember",
    bannerImagePath: nullableText(row.banner_image_path),
    destType: isDestType(row.dest_type) ? row.dest_type : "store",
    destCategoryId: typeof row.dest_category_id === "string" ? row.dest_category_id : null,
    destProductId: typeof row.dest_product_id === "string" ? row.dest_product_id : null,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

export function mapPromotionTarget(row: Row | null | undefined): PromotionTarget | null {
  if (!row || typeof row !== "object" || typeof row.id !== "string") return null;
  if (row.target_type !== "category" && row.target_type !== "product") return null;
  const role = row.target_role;
  return {
    id: row.id,
    targetType: row.target_type,
    targetRole: role === "trigger" || role === "reward" ? role : "any",
    categoryId: typeof row.category_id === "string" ? row.category_id : null,
    productId: typeof row.product_id === "string" ? row.product_id : null,
    categoryName: nullableText(row.category_name),
    productName: nullableText(row.product_name),
  };
}

export function mapPromotionCoupon(row: Row | null | undefined): PromotionCoupon | null {
  if (!row || typeof row !== "object" || typeof row.id !== "string") return null;
  if (typeof row.code !== "string" || row.code.length === 0) return null;
  return { id: row.id, code: row.code, isActive: row.is_active !== false };
}

export function mapAppliedPromotion(row: Row | null | undefined): AppliedPromotion | null {
  if (!row || typeof row !== "object") return null;
  if (typeof row.promotion_id !== "string") return null;
  return {
    promotionId: row.promotion_id,
    name: text(row.name),
    type: text(row.type),
    amountPaise: paise(row.amount),
    couponCode: nullableText(row.coupon_code),
  };
}

function mapQuoteLine(row: Row | null | undefined): QuoteLine | null {
  if (!row || typeof row !== "object") return null;
  if (typeof row.product_id !== "string") return null;
  const idx = typeof row.idx === "number" ? row.idx : 0;
  return {
    idx,
    cartItemId: null,
    productId: row.product_id,
    quantity: typeof row.quantity === "number" ? row.quantity : 0,
    unitPricePaise: paise(row.unit_price_paise),
    discountPaise: paise(row.discount_paise),
  };
}

/** Maps the engine's jsonb breakdown for display. Fails closed to EMPTY_QUOTE. */
export function mapCartQuote(raw: unknown): CartQuote {
  const row = (raw ?? {}) as Row;
  const applied = Array.isArray(row.applied)
    ? (row.applied as Row[])
        .map(mapAppliedPromotion)
        .filter((a): a is AppliedPromotion => a !== null)
    : [];
  const lines = Array.isArray(row.lines)
    ? (row.lines as Row[]).map(mapQuoteLine).filter((l): l is QuoteLine => l !== null)
    : [];
  const couponRow = row.coupon as Row | null;
  return {
    subtotalPaise: paise(row.subtotal),
    itemDiscountPaise: paise(row.item_discount_total),
    orderDiscountPaise: paise(row.order_discount_total),
    discountTotalPaise: paise(row.discount_total),
    payablePaise: paise(row.payable),
    coupon:
      couponRow && typeof couponRow === "object" && typeof couponRow.code === "string"
        ? {
            code: couponRow.code,
            valid: couponRow.valid === true,
            message: text(couponRow.message),
          }
        : null,
    applied,
    lines,
  };
}
