import { cache } from "react";

import { configurationTotalPaise } from "@/lib/catalog/pricing";
import { createClient, createServiceClient } from "@/lib/supabase/server";

import { isOrderStatusValue } from "./types";
import {
  mapNotification,
  mapOrderEvent,
  type Cart,
  type CartItem,
  type Notification,
  type Order,
  type OrderAsset,
  type OrderEvent,
} from "./types";

/**
 * Order-system reads (Phase 4).
 *
 * Everything resolves through the caller's session client, so Postgres RLS
 * is the access rule: customers see only their rows, owners see everything.
 * All functions are request-scoped (`cache()`) — carts and notifications
 * change too often for cross-request caching.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

function rowText(row: Row, key: string): string {
  return typeof row[key] === "string" ? (row[key] as string) : "";
}

function rowPaise(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Customer's cart with live catalog pricing and per-line validity. */
export const getCart = cache(async (userId: string): Promise<Cart | null> => {
  const supabase = await createClient();
  const { data: cart } = await supabase
    .from("carts")
    .select("id, coupon_code")
    .eq("customer_id", userId)
    .maybeSingle();
  const cartRow = cart as { id?: unknown; coupon_code?: unknown } | null;
  const cartId = cartRow?.id;
  if (typeof cartId !== "string") return null;
  const couponCode =
    typeof cartRow?.coupon_code === "string" && cartRow.coupon_code.length > 0
      ? cartRow.coupon_code
      : null;

  const { data: itemRows } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  const rows = ((itemRows ?? []) as Row[]).filter((row) => typeof row.id === "string");
  if (rows.length === 0) {
    return {
      id: cartId,
      items: [],
      unitCount: 0,
      subtotalPaise: 0,
      orderable: true,
      couponCode,
    };
  }

  // Batch the live catalog rows once — no N+1 per line.
  const productIds = [
    ...new Set(rows.map((row) => row.product_id).filter((id) => typeof id === "string")),
  ];
  const variantIds = [
    ...new Set(rows.map((row) => row.variant_id).filter((id) => typeof id === "string")),
  ];
  const flavourIds = [
    ...new Set(rows.map((row) => row.flavour_id).filter((id) => typeof id === "string")),
  ];

  const [productsRes, variantsRes, flavoursRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("*").in("id", productIds)
      : Promise.resolve({ data: [] as Row[] }),
    variantIds.length > 0
      ? supabase.from("product_variants").select("*").in("id", variantIds)
      : Promise.resolve({ data: [] as Row[] }),
    flavourIds.length > 0
      ? supabase.from("product_flavours").select("*").in("id", flavourIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const products = new Map(
    (((productsRes as { data: unknown }).data ?? []) as Row[])
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id as string, row]),
  );
  const variants = new Map(
    (((variantsRes as { data: unknown }).data ?? []) as Row[])
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id as string, row]),
  );
  const flavours = new Map(
    (((flavoursRes as { data: unknown }).data ?? []) as Row[])
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id as string, row]),
  );

  const items: CartItem[] = rows.map((row) => priceCartItem(row, products, variants, flavours));
  const subtotalPaise = items.reduce(
    (sum, item) => sum + (item.valid ? item.lineTotalPaise : 0),
    0,
  );
  return {
    id: cartId,
    items,
    unitCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalPaise,
    orderable: items.length > 0 && items.every((item) => item.valid),
    couponCode,
  };
});

function asPaise(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : -1;
}

/** Reprices one cart line from live rows; flags anything the catalog dropped. */
function priceCartItem(
  row: Row,
  products: Map<string, Row>,
  variants: Map<string, Row>,
  flavours: Map<string, Row>,
): CartItem {
  const invalid = (reason: string, fallbackName: string): CartItem => ({
    id: row.id as string,
    productId: typeof row.product_id === "string" ? row.product_id : null,
    productName: rowText(row, "product_name") || fallbackName,
    productSlug: null,
    variantId: typeof row.variant_id === "string" ? row.variant_id : null,
    variantLabel: rowText(row, "variant_label") || null,
    flavourId: typeof row.flavour_id === "string" ? row.flavour_id : null,
    flavourName: rowText(row, "flavour_name") || null,
    quantity: typeof row.quantity === "number" ? row.quantity : 1,
    eggEggless:
      row.egg_eggless === "eggless" ? "eggless" : row.egg_eggless === "egg" ? "egg" : null,
    message: rowText(row, "message") || null,
    designPath: rowText(row, "design_path") || null,
    pickupAt: nullableText(row, "pickup_at"),
    unitPricePaise: rowPaise(row, "unit_price_paise"),
    lineTotalPaise: 0,
    imagePath: rowText(row, "image_path") || null,
    valid: false,
    invalidReason: reason,
  });

  const product = typeof row.product_id === "string" ? products.get(row.product_id) : undefined;
  if (!product) return invalid("This product is no longer available.", "Unavailable product");
  if (product.archived_at != null || product.is_active !== true) {
    return invalid("This product is currently unavailable.", rowText(row, "product_name"));
  }

  let variant: Row | undefined;
  if (typeof row.variant_id === "string") {
    variant = variants.get(row.variant_id);
    if (!variant || variant.product_id !== product.id || variant.is_active !== true) {
      return invalid("This option is no longer available.", rowText(row, "product_name"));
    }
  }

  let flavour: Row | undefined;
  if (typeof row.flavour_id === "string") {
    flavour = flavours.get(row.flavour_id);
    if (!flavour || flavour.product_id !== product.id || flavour.is_active !== true) {
      return invalid("This flavour is no longer available.", rowText(row, "product_name"));
    }
  }

  const variantPrice = variant ? asPaise(variant.price_paise) : null;
  if (variant && (variantPrice === null || variantPrice < 0)) {
    return invalid("This option is no longer available.", rowText(row, "product_name"));
  }
  const flavourSurcharge = flavour ? asPaise(flavour.surcharge_paise) : 0;
  if (flavour && flavourSurcharge < 0) {
    return invalid("This flavour is no longer available.", rowText(row, "product_name"));
  }

  const eggEggless =
    row.egg_eggless === "eggless" ? "eggless" : row.egg_eggless === "egg" ? "egg" : null;
  if (eggEggless === "eggless" && product.egg_eggless_enabled !== true) {
    return invalid("Eggless is no longer offered for this product.", rowText(row, "product_name"));
  }
  if (rowText(row, "message") && product.message_enabled !== true) {
    return invalid(
      "Messages are no longer offered for this product.",
      rowText(row, "product_name"),
    );
  }

  const unitPricePaise = configurationTotalPaise(
    asPaise(product.base_price_paise) < 0 ? 0 : asPaise(product.base_price_paise),
    {
      variantPaise: variantPrice,
      flavourSurchargePaise: flavourSurcharge,
      egglessSelected: eggEggless === "eggless",
      egglessSurchargePaise:
        asPaise(product.eggless_surcharge_paise) < 0 ? 0 : asPaise(product.eggless_surcharge_paise),
    },
  );
  const quantity = typeof row.quantity === "number" ? row.quantity : 1;
  const pickupAt = nullableText(row, "pickup_at");
  // Pre-feature cart rows carry no pickup: they cannot check out until the
  // customer re-adds them from the product page with a chosen slot.
  if (!pickupAt || Number.isNaN(Date.parse(pickupAt))) {
    return invalid("Choose a pickup time on the product page.", rowText(row, "product_name"));
  }

  return {
    id: row.id as string,
    productId: product.id as string,
    productName: rowText(row, "product_name") || rowText(product, "name"),
    productSlug: rowText(product, "slug") || null,
    variantId: variant ? (variant.id as string) : null,
    variantLabel: variant ? rowText(variant, "label") : rowText(row, "variant_label") || null,
    flavourId: flavour ? (flavour.id as string) : null,
    flavourName: flavour ? rowText(flavour, "name") : rowText(row, "flavour_name") || null,
    quantity,
    eggEggless,
    message: rowText(row, "message") || null,
    designPath: rowText(row, "design_path") || null,
    pickupAt,
    unitPricePaise,
    lineTotalPaise: unitPricePaise * quantity,
    imagePath: rowText(row, "image_path") || null,
    valid: true,
    invalidReason: null,
  };
}

function mapOrderListRow(row: Row): {
  id: string;
  orderNumber: string;
  status: import("./machine").OrderStatus;
  grandTotalPaise: number;
  currency: string;
  createdAt: string | null;
  itemCount: number;
  customerName: string;
} | null {
  if (typeof row.id !== "string" || !rowText(row, "order_number")) return null;
  return {
    id: row.id,
    orderNumber: rowText(row, "order_number"),
    status: isOrderStatusValue(row.status) ? row.status : "pending",
    grandTotalPaise: rowPaise(row, "grand_total_paise"),
    currency: rowText(row, "currency") || "INR",
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    itemCount: Array.isArray(row.order_items) ? row.order_items.length : 0,
    customerName: rowText(row, "contact_name"),
  };
}

/** Customer's own orders, newest first (excluding ones they deleted). */
export const listCustomerOrders = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, grand_total_paise, currency, created_at, contact_name, order_items(id)",
    )
    .eq("customer_id", userId)
    .is("customer_deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  return (data as Row[]).map(mapOrderListRow).filter((row) => row !== null);
});

export type OwnerOrderFilters = {
  search?: string;
  status?: string;
  date?: string;
  sort?: "newest" | "oldest";
};

function applyOwnerFilters(
  query: {
    or: (filters: string) => unknown;
    eq: (column: string, value: unknown) => unknown;
    gte: (column: string, value: string) => unknown;
    lt: (column: string, value: string) => unknown;
    order: (column: string, options?: Record<string, unknown>) => unknown;
  },
  filters: OwnerOrderFilters,
): void {
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_,\\]/g, (char) => `\\${char}`)}%`;
    query.or(
      `order_number.ilike.${pattern},contact_name.ilike.${pattern},contact_phone.ilike.${pattern}`,
    );
  }
  if (filters.status && filters.status !== "all" && isOrderStatusValue(filters.status)) {
    query.eq("status", filters.status);
  }
  if (filters.date) {
    query.gte("created_at", `${filters.date}T00:00:00`);
    query.lt("created_at", `${filters.date}T23:59:59.999`);
  }
  query.order("created_at", { ascending: filters.sort === "oldest" });
}

/** Every order, for owners — excluding ones deleted from the console. */
export async function listOwnerOrders(filters: OwnerOrderFilters = {}) {
  const supabase = await createClient();
  const query = supabase
    .from("orders")
    .select(
      "id, order_number, status, grand_total_paise, currency, created_at, contact_name, payment_method, order_items(id)",
    )
    .is("owner_deleted_at", null);
  applyOwnerFilters(query, filters);
  const { data, error } = await query.limit(200);
  if (error || !Array.isArray(data)) return [];
  return (data as Row[]).map(mapOrderListRow).filter((row) => row !== null);
}

async function fetchOrderBundle(
  supabase: SupabaseClient,
  orderId: string,
  scope: "customer" | "owner",
) {
  const [{ data: order }, { data: items }, { data: payment }, { data: events }, { data: assets }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .is(scope === "owner" ? "owner_deleted_at" : "customer_deleted_at", null)
        .maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("payments").select("*").eq("order_id", orderId).maybeSingle(),
      supabase.from("order_events").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("order_assets").select("*").eq("order_id", orderId).order("created_at"),
    ]);
  return { order, items, payment, events, assets };
}

function mapOrderBundle(bundle: {
  order: unknown;
  items: unknown;
  payment: unknown;
  events: unknown;
  assets: unknown;
}): (Order & { events: OrderEvent[]; assets: OrderAsset[] }) | null {
  const row = bundle.order as Row | null;
  if (!row || typeof row !== "object" || typeof row.id !== "string") return null;
  if (!isOrderStatusValue(row.status)) return null;
  const items = (Array.isArray(bundle.items) ? bundle.items : []).map((entry) => {
    const item = entry as Row;
    return {
      id: typeof item.id === "string" ? item.id : "",
      productId: typeof item.product_id === "string" ? item.product_id : null,
      productName: rowText(item, "product_name"),
      productSlug: rowText(item, "product_slug"),
      variantLabel: nullableText(item, "variant_label"),
      variantValue: nullableText(item, "variant_value"),
      flavourName: nullableText(item, "flavour_name"),
      eggEggless:
        item.egg_eggless === "eggless"
          ? ("eggless" as const)
          : item.egg_eggless === "egg"
            ? ("egg" as const)
            : null,
      message: nullableText(item, "message"),
      designPath: nullableText(item, "design_path"),
      unitPricePaise: rowPaise(item, "unit_price_paise"),
      quantity: typeof item.quantity === "number" ? item.quantity : 1,
      lineTotalPaise: rowPaise(item, "line_total_paise"),
      lineDiscountPaise: rowPaise(item, "discount_paise"),
      imagePath: nullableText(item, "image_path"),
    };
  });
  const paymentRow = bundle.payment as Row | null;
  return {
    id: row.id,
    orderNumber: rowText(row, "order_number"),
    customerId: typeof row.customer_id === "string" ? row.customer_id : null,
    status: row.status,
    subtotalPaise: rowPaise(row, "subtotal_paise"),
    discountPaise: rowPaise(row, "discount_paise"),
    taxPaise: rowPaise(row, "tax_paise"),
    chargesPaise: rowPaise(row, "charges_paise"),
    grandTotalPaise: rowPaise(row, "grand_total_paise"),
    currency: rowText(row, "currency") || "INR",
    contactName: rowText(row, "contact_name"),
    contactPhone: rowText(row, "contact_phone"),
    contactEmail: rowText(row, "contact_email"),
    paymentMethod: rowText(row, "payment_method"),
    pickupAt: nullableText(row, "pickup_at"),
    discountBreakdown: Array.isArray(row.promo_breakdown)
      ? (row.promo_breakdown as Row[]).map((entry) => ({
          promotionId: typeof entry.promotion_id === "string" ? entry.promotion_id : "",
          name: typeof entry.name === "string" ? entry.name : "",
          type: typeof entry.type === "string" ? entry.type : "",
          amountPaise: rowPaise(entry, "amount"),
          couponCode:
            typeof entry.coupon_code === "string" && entry.coupon_code.length > 0
              ? entry.coupon_code
              : null,
        }))
      : [],
    couponCode:
      typeof row.coupon_code === "string" && row.coupon_code.length > 0 ? row.coupon_code : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    items,
    payment:
      paymentRow && typeof paymentRow === "object"
        ? {
            method: rowText(paymentRow, "method"),
            status: rowText(paymentRow, "status"),
            amountPaise: rowPaise(paymentRow, "amount_paise"),
            currency: rowText(paymentRow, "currency") || "INR",
          }
        : null,
    events: (Array.isArray(bundle.events) ? bundle.events : [])
      .map((entry) => mapOrderEvent(entry as Row))
      .filter((event): event is OrderEvent => event !== null),
    assets: (Array.isArray(bundle.assets) ? bundle.assets : [])
      .filter((entry): entry is Row => !!entry && typeof entry === "object")
      .filter((entry) => typeof entry.id === "string")
      .map((entry) => ({
        id: entry.id as string,
        kind: rowText(entry, "kind"),
        storagePath: rowText(entry, "storage_path"),
      })),
  };
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (typeof value !== "string") return null;
  return value.trim().length > 0 ? value : null;
}

/** One order with items, payment, timeline and assets. RLS decides visibility;
 *  `scope` additionally hides rows the calling side deleted. */
export const getOrderBundle = cache(
  async (orderId: string, scope: "customer" | "owner" = "customer") => {
    const supabase = await createClient();
    return mapOrderBundle(await fetchOrderBundle(supabase, orderId, scope));
  },
);

/** Notifications for the bell + center, newest first. */
export const listNotifications = cache(async (userId: string, limit = 20) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return (data as Row[]).map(mapNotification).filter((row): row is Notification => row !== null);
});

export const unreadNotificationCount = cache(async (userId: string): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);
  return count ?? 0;
});

/** Signed preview URL for a private design asset. Callers verify ownership first. */
export async function signedDesignUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const admin = createServiceClient();
  const { data, error } = await admin.storage
    .from("customer-designs")
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
