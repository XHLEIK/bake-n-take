import type { OrderStatus } from "./machine";

/**
 * Order-system application model (Phase 4).
 *
 * Money is integer paise. Orders and their items are immutable snapshots:
 * mappers fail closed on unknown values so a bad row degrades instead of
 * crashing a page.
 */

export type CartItem = {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  variantId: string | null;
  variantLabel: string | null;
  flavourId: string | null;
  flavourName: string | null;
  quantity: number;
  eggEggless: "egg" | "eggless" | null;
  message: string | null;
  designPath: string | null;
  /** Requested pickup instant (UTC ISO); null on pre-feature rows. */
  pickupAt: string | null;
  /** Authoritative unit price recomputed from live catalog rows. */
  unitPricePaise: number;
  lineTotalPaise: number;
  imagePath: string | null;
  /** False when the live catalog no longer supports this configuration. */
  valid: boolean;
  invalidReason: string | null;
};

export type Cart = {
  id: string;
  items: CartItem[];
  /** Total units (the header badge convention). */
  unitCount: number;
  subtotalPaise: number;
  /** True when every line is backed by live catalog data. */
  orderable: boolean;
  /** Normalized coupon saved on the cart (validated at quote time). */
  couponCode: string | null;
};

export type OrderItemSnapshot = {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  variantLabel: string | null;
  variantValue: string | null;
  flavourName: string | null;
  eggEggless: "egg" | "eggless" | null;
  message: string | null;
  designPath: string | null;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
  /** Item-level promotion reward captured at order time (0 when none). */
  lineDiscountPaise: number;
  imagePath: string | null;
};

export type PaymentSnapshot = {
  method: string;
  status: string;
  amountPaise: number;
  currency: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  status: OrderStatus;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  chargesPaise: number;
  grandTotalPaise: number;
  currency: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  paymentMethod: string;
  /** Requested pickup instant (UTC ISO): the latest per-line pickup. Null on pre-feature orders. */
  pickupAt: string | null;
  /** Immutable promotion snapshot (empty when no offer applied). */
  discountBreakdown: {
    promotionId: string;
    name: string;
    type: string;
    amountPaise: number;
    couponCode: string | null;
  }[];
  couponCode: string | null;
  createdAt: string | null;
  items: OrderItemSnapshot[];
  payment: PaymentSnapshot | null;
};

export type OrderEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string | null;
  createdAt: string | null;
};

export type OrderAsset = {
  id: string;
  kind: string;
  storagePath: string;
};

export const NOTIFICATION_TYPES = [
  "ORDER_PLACED",
  "ORDER_CONFIRMED",
  "ORDER_BAKING",
  "ORDER_READY",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
  "NEW_ORDER",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string | null;
};

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function isOrderStatusValue(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    ["pending", "confirmed", "baking", "ready_for_pickup", "completed", "cancelled"].includes(value)
  );
}

export function mapOrderEvent(row: Row | null | undefined): OrderEvent | null {
  if (!row || typeof row !== "object" || typeof row.id !== "string") return null;
  return {
    id: row.id,
    eventType: text(row.event_type),
    fromStatus: typeof row.from_status === "string" ? row.from_status : null,
    toStatus: typeof row.to_status === "string" ? row.to_status : null,
    actorId: typeof row.actor_id === "string" ? row.actor_id : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export function mapNotification(row: Row | null | undefined): Notification | null {
  if (!row || typeof row !== "object") return null;
  if (typeof row.id !== "string") return null;
  return {
    id: row.id,
    type: text(row.type),
    title: text(row.title),
    message: text(row.message),
    entityType: typeof row.entity_type === "string" ? row.entity_type : null,
    entityId: typeof row.entity_id === "string" ? row.entity_id : null,
    isRead: row.is_read === true,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}
