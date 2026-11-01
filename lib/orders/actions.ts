"use server";

import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";

import { errorState, successState, type AuthFormState } from "@/lib/auth/form-state";
import { getSessionContext, requireUser } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/roles";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { configurationTotalPaise } from "@/lib/catalog/pricing";
import { isWithinStoreHours } from "@/lib/orders/pickup";
import { getStoreSettings } from "@/lib/store/repository";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import {
  cartItemSchema,
  contactSchema,
  IDEMPOTENCY_PATTERN,
  paymentSchema,
  type CartItemInput,
} from "@/lib/orders/validation";
import { isOrderStatus } from "@/lib/orders/machine";
import { getOrderBundle } from "@/lib/orders/repository";

/**
 * Order-system writes (Phase 4).
 *
 * Every mutation resolves identity server-side and re-derives prices from
 * catalog rows. Form state shapes follow the auth convention; cart mutations
 * return counts for the header badge.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type CartActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  cartUnitCount?: number;
  /** New or merged line id — used by Order Now to scope checkout. */
  cartItemId?: string;
};

function cartError(message: string): CartActionState {
  return { status: "error", message };
}

async function getOrCreateCartId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("customer_id", userId)
    .maybeSingle();
  const id = (existing as { id?: unknown } | null)?.id;
  if (typeof id === "string") return id;
  const { data: created, error } = await supabase
    .from("carts")
    .insert({ customer_id: userId })
    .select("id")
    .maybeSingle();
  if (error) return null;
  const createdId = (created as { id?: unknown } | null)?.id;
  return typeof createdId === "string" ? createdId : null;
}

type PricedConfiguration = {
  unitPricePaise: number;
  productName: string;
  variantLabel: string | null;
  flavourName: string | null;
  imagePath: string | null;
  /** Owner-configured minimum lead time in whole minutes. */
  minPrepMinutes: number;
};

/**
 * Authoritative pricing for one configuration: re-reads product, variant and
 * flavour rows and recomputes. Returns null when the catalog no longer
 * supports the selection (archived, inactive, mismatched).
 */
async function priceConfiguration(
  supabase: SupabaseClient,
  input: {
    productId: string;
    variantId: string | null;
    flavourId: string | null;
    eggEggless: string;
  },
): Promise<PricedConfiguration | null> {
  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, base_price_paise, is_active, archived_at, egg_eggless_enabled, message_enabled, min_prep_minutes",
    )
    .eq("id", input.productId)
    .maybeSingle();
  const row = product as Record<string, unknown> | null;
  if (!row || row.archived_at != null || row.is_active !== true) return null;

  const basePaise =
    typeof row.base_price_paise === "number" &&
    Number.isInteger(row.base_price_paise) &&
    row.base_price_paise >= 0
      ? row.base_price_paise
      : 0;

  let variantPrice: number | null = null;
  let variantLabel: string | null = null;
  if (input.variantId) {
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id, product_id, label, price_paise, is_active")
      .eq("id", input.variantId)
      .maybeSingle();
    const v = variant as Record<string, unknown> | null;
    if (!v || v.product_id !== row.id || v.is_active !== true) return null;
    if (
      typeof v.price_paise !== "number" ||
      !Number.isInteger(v.price_paise) ||
      v.price_paise < 1
    ) {
      return null;
    }
    variantPrice = v.price_paise;
    variantLabel = typeof v.label === "string" ? v.label : null;
  } else {
    const { count } = await supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", row.id)
      .eq("is_active", true);
    if ((count ?? 0) > 0) return null;
  }

  let flavourSurcharge = 0;
  let flavourName: string | null = null;
  if (input.flavourId) {
    const { data: flavour } = await supabase
      .from("product_flavours")
      .select("id, product_id, name, surcharge_paise, is_active")
      .eq("id", input.flavourId)
      .maybeSingle();
    const f = flavour as Record<string, unknown> | null;
    if (!f || f.product_id !== row.id || f.is_active !== true) return null;
    if (
      typeof f.surcharge_paise !== "number" ||
      !Number.isInteger(f.surcharge_paise) ||
      f.surcharge_paise < 0
    ) {
      return null;
    }
    flavourSurcharge = f.surcharge_paise;
    flavourName = typeof f.name === "string" ? f.name : null;
  }

  const eggless = input.eggEggless === "eggless";
  if (eggless && row.egg_eggless_enabled !== true) return null;
  const egglessSurcharge =
    typeof row.eggless_surcharge_paise === "number" && Number.isInteger(row.eggless_surcharge_paise)
      ? Math.max(0, row.eggless_surcharge_paise)
      : 0;

  const { data: image } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", row.id)
    .order("is_primary", { ascending: false })
    .order("display_order")
    .limit(1)
    .maybeSingle();

  return {
    unitPricePaise: configurationTotalPaise(basePaise, {
      variantPaise: variantPrice,
      flavourSurchargePaise: flavourSurcharge,
      egglessSelected: eggless,
      egglessSurchargePaise: egglessSurcharge,
    }),
    productName: typeof row.name === "string" ? row.name : "",
    variantLabel,
    flavourName,
    imagePath:
      typeof (image as { storage_path?: unknown } | null)?.storage_path === "string"
        ? (image as { storage_path: string }).storage_path
        : null,
    minPrepMinutes:
      typeof row.min_prep_minutes === "number" &&
      Number.isInteger(row.min_prep_minutes) &&
      row.min_prep_minutes >= 0
        ? row.min_prep_minutes
        : 720,
  };
}

function validDesignPath(userId: string, path: string): boolean {
  return path.length > 0 && path.startsWith(`tmp/${userId}/`) && !path.includes("..");
}

/** Adds a server-priced configuration line to the caller's cart. */
export async function addToCartAction(
  input: CartItemInput & { quantity: number },
): Promise<CartActionState> {
  const session = await requireUser("/webstore");
  const parsed = cartItemSchema.safeParse({ ...input, quantity: input.quantity });
  if (!parsed.success) return cartError("That configuration is not available anymore.");

  const data = parsed.data;
  if (data.message && data.message.length > 0 && !(await messageAllowed(data.productId))) {
    return cartError("Messages are not offered for this product.");
  }
  if (data.designPath && !validDesignPath(session.user.id, data.designPath)) {
    return cartError("That design reference is invalid.");
  }

  const supabase = await createClient();
  const priced = await priceConfiguration(supabase, {
    productId: data.productId,
    variantId: data.variantId,
    flavourId: data.flavourId,
    eggEggless: data.eggEggless,
  });
  if (!priced) return cartError("That configuration is not available anymore.");

  // Pickup is chosen on the product page and re-checked here against the
  // live minimum — the checkout and the database check it again.
  const pickupMs = Date.parse(data.pickupAt);
  if (Number.isNaN(pickupMs) || pickupMs < Date.now() + priced.minPrepMinutes * 60 * 1000) {
    return cartError("That pickup time is too soon — this bake needs more preparation time.");
  }

  const cartId = await getOrCreateCartId(supabase, session.user.id);
  if (!cartId) return cartError("We could not open your cart. Please try again.");

  // Same configuration without a design merges quantities; staged designs
  // stay separate lines because each file is unique. Pickup slots never
  // merge: different slots stay separate lines so no chosen time is lost.
  if (!data.designPath) {
    const egg = data.eggEggless || null;
    const note = data.message || null;
    const pickupIso = new Date(pickupMs).toISOString();
    let lookup = supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("product_id", data.productId)
      .is("design_path", null)
      .eq("pickup_at", pickupIso);
    lookup = egg ? lookup.eq("egg_eggless", egg) : lookup.is("egg_eggless", null);
    lookup = note ? lookup.eq("message", note) : lookup.is("message", null);
    lookup = data.variantId
      ? lookup.eq("variant_id", data.variantId)
      : lookup.is("variant_id", null);
    lookup = data.flavourId
      ? lookup.eq("flavour_id", data.flavourId)
      : lookup.is("flavour_id", null);
    const { data: existing } = await lookup.maybeSingle();
    const line = existing as { id: string; quantity: number } | null;
    if (line) {
      const quantity = Math.min(99, line.quantity + data.quantity);
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity, unit_price_paise: priced.unitPricePaise })
        .eq("id", line.id)
        .eq("cart_id", cartId);
      if (error) return cartError("We could not update your cart. Please try again.");
      return {
        status: "success",
        cartUnitCount: await cartUnitCount(supabase, cartId),
        cartItemId: line.id,
      };
    }
  }

  const { data: created, error } = await supabase
    .from("cart_items")
    .insert({
      cart_id: cartId,
      product_id: data.productId,
      variant_id: data.variantId,
      flavour_id: data.flavourId,
      quantity: data.quantity,
      egg_eggless: data.eggEggless || null,
      message: data.message || null,
      design_path: data.designPath || null,
      pickup_at: new Date(pickupMs).toISOString(),
      product_name: priced.productName,
      variant_label: priced.variantLabel,
      flavour_name: priced.flavourName,
      unit_price_paise: priced.unitPricePaise,
      image_path: priced.imagePath,
    })
    .select("id")
    .maybeSingle();
  if (error || !created) return cartError("We could not update your cart. Please try again.");
  const createdId = (created as { id?: unknown }).id;
  return {
    status: "success",
    cartUnitCount: await cartUnitCount(supabase, cartId),
    cartItemId: typeof createdId === "string" ? createdId : undefined,
  };
}

async function messageAllowed(productId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("message_enabled")
    .eq("id", productId)
    .maybeSingle();
  return (data as { message_enabled?: unknown } | null)?.message_enabled === true;
}

async function cartUnitCount(supabase: SupabaseClient, cartId: string): Promise<number> {
  const { data } = await supabase.from("cart_items").select("quantity").eq("cart_id", cartId);
  return ((data ?? []) as { quantity: number }[]).reduce(
    (sum, row) => sum + (row.quantity || 0),
    0,
  );
}

async function ownCartItem(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<{ id: string; cart_id: string } | null> {
  const { data } = await supabase
    .from("cart_items")
    .select("id, cart_id")
    .eq("id", itemId)
    .maybeSingle();
  const row = data as { id?: unknown; cart_id?: unknown } | null;
  if (!row || typeof row.id !== "string" || typeof row.cart_id !== "string") return null;
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("id", row.cart_id)
    .eq("customer_id", userId)
    .maybeSingle();
  if (!cart) return null;
  return { id: row.id, cart_id: row.cart_id };
}

export async function updateCartItemQuantityAction(
  itemId: string,
  quantity: number,
): Promise<CartActionState> {
  const session = await requireUser("/webstore");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return cartError("Quantity must be between 1 and 99.");
  }
  const supabase = await createClient();
  const line = await ownCartItem(supabase, session.user.id, itemId);
  if (!line) return cartError("That cart item was not found.");

  // Reprice from live rows: catalog edits between visits never linger.
  const { data: current } = await supabase
    .from("cart_items")
    .select("product_id, variant_id, flavour_id, egg_eggless")
    .eq("id", itemId)
    .maybeSingle();
  const currentRow = current as Record<string, unknown> | null;
  const priced = await priceConfiguration(supabase, {
    productId: typeof currentRow?.product_id === "string" ? currentRow.product_id : "",
    variantId: typeof currentRow?.variant_id === "string" ? currentRow.variant_id : null,
    flavourId: typeof currentRow?.flavour_id === "string" ? currentRow.flavour_id : null,
    eggEggless: typeof currentRow?.egg_eggless === "string" ? currentRow.egg_eggless : "",
  });
  if (!priced) return cartError("That configuration is not available anymore.");

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity, unit_price_paise: priced.unitPricePaise })
    .eq("id", itemId);
  if (error) return cartError("We could not update your cart. Please try again.");
  return { status: "success", cartUnitCount: await cartUnitCount(supabase, line.cart_id) };
}

export async function removeCartItemAction(itemId: string): Promise<CartActionState> {
  const session = await requireUser("/webstore");
  const supabase = await createClient();
  const line = await ownCartItem(supabase, session.user.id, itemId);
  if (!line) return cartError("That cart item was not found.");

  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) return cartError("We could not update your cart. Please try again.");
  return { status: "success", cartUnitCount: await cartUnitCount(supabase, line.cart_id) };
}

export async function clearCartAction(): Promise<CartActionState> {
  const session = await requireUser("/webstore");
  const supabase = await createClient();
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("customer_id", session.user.id)
    .maybeSingle();
  const cartId = (cart as { id?: unknown } | null)?.id;
  if (typeof cartId !== "string") return { status: "success", cartUnitCount: 0 };

  const { error } = await supabase.from("cart_items").delete().eq("cart_id", cartId);
  if (error) return cartError("We could not clear your cart. Please try again.");
  return { status: "success", cartUnitCount: 0 };
}

// ---------------------------------------------------------------------------
// Checkout — single transactional order creation with idempotency
// ---------------------------------------------------------------------------

const ORDER_ERRORS: [RegExp, string][] = [
  [/NOT_AUTHENTICATED/, "Your session has ended. Please sign in again to continue."],
  [/CART_EMPTY/, "Your cart is empty."],
  [/INVALID_PAYMENT_METHOD/, "Choose how to pay."],
  [/INVALID_CONTACT/, "Please check the name, phone and email for this order."],
  [/STORE_NOT_ACCEPTING/, "Ordering is paused right now. Please try again later."],
  [/PRODUCT_UNAVAILABLE/, "Something in your cart is no longer available. Please review it."],
  [/VARIANT_REQUIRED/, "One of your items needs an option selected. Please review it."],
  [/VARIANT_UNAVAILABLE/, "One of your options is no longer available. Please review it."],
  [/FLAVOUR_UNAVAILABLE/, "One of your flavours is no longer available. Please review it."],
  [/INVALID_CONFIGURATION/, "One of your items has an invalid configuration. Please review it."],
  [/INVALID_PICKUP/, "Choose a pickup time for every item before ordering."],
  [
    /PICKUP_TOO_EARLY/,
    "One of your items needs more preparation time — please pick a later pickup.",
  ],
  [/INVALID_QUANTITY/, "Quantities must be between 1 and 99."],
  [/DESIGN_MISSING/, "One of your designs is missing. Please re-upload it."],
  [/ORDER_NOT_FOUND/, "That order was not found."],
  [/INVALID_TRANSITION/, "That change is not allowed for this order."],
  [/PAYMENT_REQUIRED/, "Please confirm payment was received before completing the order."],
  [/ORDER_NOT_DELETABLE/, "Only completed orders can be deleted."],
  [/COUPON_INVALID/, "That coupon code is not valid for this order."],
  [/PROMOTION_CONSUMED/, "An offer in your order was just claimed — please review your cart."],
  [/INVALID_PROMOTION/, "An offer in your order changed — please review your cart."],
];

function curatedOrderError(message: string): string {
  for (const [pattern, curated] of ORDER_ERRORS) {
    if (pattern.test(message)) return curated;
  }
  return "We could not place your order. Please try again.";
}

export async function placeOrderAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await requireUser("/webstore");

  const contact = {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const method = String(formData.get("paymentMethod") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const itemIds = formData
    .getAll("itemId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const contactParsed = contactSchema.safeParse(contact);
  if (!contactParsed.success) {
    return errorState(
      "Please check the order details and try again.",
      fieldErrorsFrom(contactParsed.error),
    );
  }
  if (!paymentSchema.safeParse({ method }).success) {
    return errorState("Choose how to pay.");
  }
  if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    return errorState("Please reload the checkout and try again.");
  }

  const supabase = await createClient();
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("customer_id", session.user.id)
    .maybeSingle();
  const cartId = (cart as { id?: unknown } | null)?.id;
  if (typeof cartId !== "string") return errorState("Your cart is empty.");
  // The coupon lives on the cart row (managed by the coupon form) and is
  // re-validated by the promotion engine at order creation — the browser
  // never decides eligibility or amounts.
  const cartRow = cart as { coupon_code?: unknown } | null;
  const cartCoupon = typeof cartRow?.coupon_code === "string" ? cartRow.coupon_code : null;

  // Expand the order lines from the customer's own cart rows — prices and
  // configuration come from the database here, never from the browser. An
  // explicit item list scopes Order-Now checkouts; otherwise the whole cart.
  let query = supabase.from("cart_items").select("*").eq("cart_id", cartId);
  if (itemIds.length > 0) query = query.in("id", itemIds);
  const { data: rows } = await query;
  const lines = ((rows ?? []) as Record<string, unknown>[]).filter(
    (row) => typeof row.id === "string",
  );
  if (lines.length === 0) return errorState("Your cart is empty.");

  // Pickup is validated here against live minimums and store hours; the
  // database re-checks the minimum inequality inside the transaction, so a
  // forged request or a stale page cannot slip an early slot through.
  const nowMs = Date.now();
  const lineProductIds = [
    ...new Set(
      lines.map((row) => row.product_id).filter((id): id is string => typeof id === "string"),
    ),
  ];
  const { data: prepRows } =
    lineProductIds.length > 0
      ? await supabase.from("products").select("id, min_prep_minutes").in("id", lineProductIds)
      : { data: [] as Record<string, unknown>[] };
  const prepByProduct = new Map(
    ((prepRows ?? []) as Record<string, unknown>[])
      .filter((row) => typeof row.id === "string")
      .map((row) => [
        row.id as string,
        typeof row.min_prep_minutes === "number" && Number.isInteger(row.min_prep_minutes)
          ? Math.max(0, row.min_prep_minutes)
          : 720,
      ]),
  );
  const settings = await getStoreSettings();
  for (const row of lines) {
    const raw = typeof row.pickup_at === "string" ? row.pickup_at : "";
    const at = Date.parse(raw);
    if (!raw || Number.isNaN(at)) {
      return errorState("Choose a pickup time for every item before ordering.");
    }
    const prep = prepByProduct.get(typeof row.product_id === "string" ? row.product_id : "") ?? 720;
    if (at < nowMs + prep * 60 * 1000) {
      return errorState("One of your pickup times is now too soon — please pick a later slot.");
    }
    if (settings && !isWithinStoreHours(at, settings.hours)) {
      return errorState("One of your pickup times falls outside bakery hours.");
    }
  }

  const payload = lines.map((row) => ({
    product_id: row.product_id,
    variant_id: typeof row.variant_id === "string" ? row.variant_id : null,
    flavour_id: typeof row.flavour_id === "string" ? row.flavour_id : null,
    egg_eggless: typeof row.egg_eggless === "string" && row.egg_eggless ? row.egg_eggless : null,
    message: typeof row.message === "string" && row.message ? row.message : null,
    design_path: typeof row.design_path === "string" && row.design_path ? row.design_path : null,
    pickup_at: typeof row.pickup_at === "string" ? row.pickup_at : null,
    quantity: row.quantity,
  }));

  const { data, error } = await supabase.rpc("create_order", {
    p_items: payload,
    p_contact: { name: contact.fullName, phone: contact.phone, email: contact.email },
    p_payment_method: method,
    p_idempotency_key: idempotencyKey,
    p_cart_item_ids: lines.map((row) => row.id as string),
    p_coupon_code: cartCoupon,
  });

  if (error) return errorState(curatedOrderError(error.message));
  const result = data as { order_id?: unknown; order_number?: unknown } | null;
  if (!result || typeof result.order_id !== "string") {
    return errorState("We could not place your order. Please try again.");
  }

  revalidatePath("/", "layout");
  redirect(`/webstore/${session.user.id}/orders/${result.order_id}?fresh=1`);
}

// ---------------------------------------------------------------------------
// Status transitions (UI affordances mirror the machine; the RPC enforces)
// ---------------------------------------------------------------------------

export async function transitionOrderAction(
  orderId: string,
  toStatus: string,
  opts?: { paymentReceived?: boolean },
): Promise<AuthFormState> {
  if (!isOrderStatus(toStatus)) return errorState("That change is not allowed for this order.");

  const session = await getSessionContext();
  if (!session) return errorState("Your session has ended. Please sign in again to continue.");

  // Allowed transitions are enforced by transition_order in the database;
  // its INVALID_TRANSITION maps to a curated message below. Completing an
  // order additionally requires the paid confirmation, which flips the
  // payment row to success in the same transaction.
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_to_status: toStatus,
    p_payment_received: opts?.paymentReceived ?? false,
  });
  if (error) return errorState(curatedOrderError(error.message));

  revalidatePath("/", "layout");
  return successState(`Order moved to ${toStatus.replace(/_/g, " ")}.`);
}

/** Customer cancellation: pending orders only (enforced in the database). */
export async function cancelOrderAction(orderId: string): Promise<AuthFormState> {
  return transitionOrderAction(orderId, "cancelled");
}

/**
 * Deletes a completed order from the caller's side and lands back on the
 * orders list. A customer delete hides it from the customer while the owner
 * keeps it, and vice versa; the row is physically removed only once both
 * sides have deleted it.
 *
 * Visibility and the completed-only rule are checked here for curated
 * messages AND inside `delete_order`, so a forged id can at worst hide
 * the caller's own finished history. Design files are removed best-effort
 * afterwards — the rows are already gone by then. The redirect is
 * server-side with history replacement, so it cannot lose a race with the
 * deleted detail page and Back never lands on its 404.
 */
export async function deleteOrderAction(orderId: string, returnTo: string): Promise<AuthFormState> {
  const session = await getSessionContext();
  if (!session) return errorState("Your session has ended. Please sign in again to continue.");

  // Never follow a client-supplied URL off-site or elsewhere in the app.
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return errorState("We could not delete that order. Please try again.");
  }

  const bundle = await getOrderBundle(orderId, isOwner(session.profile) ? "owner" : "customer");
  if (!bundle) return errorState("That order was not found.");
  if (!isOwner(session.profile) && bundle.customerId !== session.user.id) {
    return errorState("That order was not found.");
  }
  if (bundle.status !== "completed") {
    return errorState("Only completed orders can be deleted.");
  }
  const designPaths = bundle.assets
    .map((asset) => asset.storagePath)
    .filter((path) => path.length > 0);

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_order", { p_order_id: orderId });
  if (error) return errorState(curatedOrderError(error.message));

  try {
    if (designPaths.length > 0) {
      const admin = createServiceClient();
      await admin.storage.from("customer-designs").remove(designPaths);
    }
  } catch {
    // Rows are gone; leftover private files are inert.
  }

  revalidatePath("/", "layout");
  // Replace (not push) the history entry: the deleted detail page no longer
  // exists, so pressing Back must skip it instead of landing on its 404.
  redirect(returnTo, RedirectType.replace);
}

// ---------------------------------------------------------------------------
// Notifications (recipients manage only their own)
//
// All four actions resolve identity server-side and scope every write to
// `recipient_id = own id`. Row Level Security enforces the same rule in the
// database, so a forged notification id can at worst touch the caller's own
// rows. Owners and customers share these actions — the bell is the only UI.

export async function markNotificationReadAction(id: string): Promise<AuthFormState> {
  const session = await getSessionContext();
  if (!session) return errorState("Your session has ended. Please sign in again to continue.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", session.user.id);
  if (error) return errorState("We could not update that notification.");
  revalidatePath("/", "layout");
  return successState("Marked as read.");
}

export async function markAllNotificationsReadAction(): Promise<AuthFormState> {
  const session = await getSessionContext();
  if (!session) return errorState("Your session has ended. Please sign in again to continue.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", session.user.id)
    .eq("is_read", false);
  if (error) return errorState("We could not update your notifications.");
  revalidatePath("/", "layout");
  return successState("All caught up.");
}

/** Deletes one notification belonging to the caller. */
export async function deleteNotificationAction(id: string): Promise<AuthFormState> {
  const session = await getSessionContext();
  if (!session) return errorState("Your session has ended. Please sign in again to continue.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("recipient_id", session.user.id);
  if (error) return errorState("We could not delete that notification.");
  revalidatePath("/", "layout");
  return successState("Notification deleted.");
}

/** Deletes only the caller's notifications that are already marked as read. */
export async function deleteReadNotificationsAction(): Promise<AuthFormState> {
  const session = await getSessionContext();
  if (!session) return errorState("Your session has ended. Please sign in again to continue.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", session.user.id)
    .eq("is_read", true);
  if (error) return errorState("We could not delete your read notifications.");
  revalidatePath("/", "layout");
  return successState("Read notifications deleted.");
}
