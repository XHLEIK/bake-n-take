"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, successState, type AuthFormState } from "@/lib/auth/form-state";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseForm } from "@/lib/validation/auth";
import { validateImageUpload } from "@/lib/store/validation";

import { canTransitionStatus } from "./status";
import {
  GALLERY_PATH_PATTERN,
  isValidCouponCode,
  istLocalToIso,
  normalizeCouponCode,
  parseCouponLines,
  promotionFormSchema,
  PROMOTION_FORM_FIELDS,
  rupeesToPaise,
  type PromotionFormInput,
} from "./validation";
import type { PromotionStatus, PromotionType } from "./types";

/**
 * Promotion mutations (Phase 5).
 *
 * Every owner export starts with requireOwner — RLS owner policies are the
 * second layer, never the only one. Money arrives as rupees strings and is
 * converted to paise once, here. Coupon-gated promotions never auto-apply
 * (enforced by validation). Each mutation writes a promotion_events audit
 * row in the same request.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshOffers(): void {
  revalidatePath("/", "layout");
}

async function logEvent(
  supabase: SupabaseClient,
  promotionId: string | null,
  actorId: string,
  eventType: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("promotion_events").insert({
    promotion_id: promotionId,
    actor_id: actorId,
    event_type: eventType,
    details,
  });
}

type BuiltPromotion = {
  row: Record<string, unknown>;
  targets: {
    target_type: string;
    target_role: string;
    category_id: string | null;
    product_id: string | null;
  }[];
  coupons: string[];
};

function buildConfig(data: PromotionFormInput): Record<string, unknown> {
  switch (data.type as PromotionType) {
    case "percentage":
      return { percent: Number(data.percent) };
    case "buy_x_get_y":
      return {
        buy_qty: Number(data.buyQty),
        reward_qty: Number(data.rewardQty),
        reward_kind: data.rewardKind,
        reward_percent: data.rewardKind === "percent" ? Number(data.rewardPercent) : 100,
        reward_price_paise:
          data.rewardKind === "price" ? (rupeesToPaise(Number(data.rewardPriceRupees)) ?? 0) : 0,
      };
    case "mix_match":
      return {
        bundle_qty: Number(data.bundleQty),
        bundle_price_paise: rupeesToPaise(Number(data.bundlePriceRupees)) ?? 0,
      };
    case "first_order":
      return data.foKind === "percent"
        ? { kind: "percent", value: Number(data.foValue) }
        : { kind: "fixed", value: rupeesToPaise(Number(data.foValue)) ?? 0 };
  }
}

function buildTargets(data: PromotionFormInput): BuiltPromotion["targets"] {
  const targets: BuiltPromotion["targets"] = [];
  const push = (role: string, type: "category" | "product", ids: string[]): void => {
    for (const id of ids) {
      targets.push({
        target_type: type,
        target_role: role,
        category_id: type === "category" ? id : null,
        product_id: type === "product" ? id : null,
      });
    }
  };
  if (data.type === "buy_x_get_y") {
    push("trigger", "category", data.triggerCategoryIds);
    push("trigger", "product", data.triggerProductIds);
    push("reward", "category", data.rewardCategoryIds);
    push("reward", "product", data.rewardProductIds);
  } else {
    push("any", "category", data.categoryIds);
    push("any", "product", data.productIds);
  }
  return targets;
}

/** Verifies referenced categories/products still exist (curated errors). */
async function verifyTargets(
  supabase: SupabaseClient,
  targets: BuiltPromotion["targets"],
  destCategoryId: string | null,
  destProductId: string | null,
): Promise<string | null> {
  const categoryIds = [
    ...new Set(
      [...targets.map((t) => t.category_id), destCategoryId].filter(
        (id): id is string => typeof id === "string",
      ),
    ),
  ];
  const productIds = [
    ...new Set(
      [...targets.map((t) => t.product_id), destProductId].filter(
        (id): id is string => typeof id === "string",
      ),
    ),
  ];
  if (categoryIds.length > 0) {
    const { data } = await supabase.from("categories").select("id").in("id", categoryIds);
    const found = new Set(((data ?? []) as Row[]).map((r) => r.id));
    if (categoryIds.some((id) => !found.has(id)))
      return "A selected category is no longer available.";
  }
  if (productIds.length > 0) {
    const { data } = await supabase.from("products").select("id").in("id", productIds);
    const found = new Set(((data ?? []) as Row[]).map((r) => r.id));
    if (productIds.some((id) => !found.has(id)))
      return "A selected product is no longer available.";
  }
  return null;
}

function buildRow(
  data: PromotionFormInput,
  actorId: string,
  status: PromotionStatus,
): Record<string, unknown> {
  return {
    name: data.name,
    type: data.type,
    status,
    priority: data.priority,
    is_exclusive: data.isExclusive,
    is_stackable: data.isStackable,
    auto_apply: data.autoApply,
    repeatable: data.repeatable,
    starts_at: istLocalToIso(data.startsAt),
    ends_at: istLocalToIso(data.endsAt),
    min_order_paise: data.minOrderRupees ?? 0,
    max_discount_paise: data.maxDiscountRupees,
    max_uses_global: data.maxUsesGlobal,
    max_uses_per_customer: data.maxUsesPerCustomer,
    config: buildConfig(data),
    // The banner header is always the offer name.
    banner_header: data.name.slice(0, 60),
    banner_title: data.bannerTitle.trim().length > 0 ? data.bannerTitle.trim() : null,
    banner_description:
      data.bannerDescription.trim().length > 0 ? data.bannerDescription.trim() : null,
    banner_cta_label: data.bannerCtaLabel.trim().length > 0 ? data.bannerCtaLabel.trim() : null,
    banner_style: data.bannerStyle,
    // Destination is derived from targeting (see deriveDestination) and
    // overwritten by the caller after buildRow.
    dest_type: "store",
    dest_category_id: null,
    dest_product_id: null,
    created_by: actorId,
  };
}

/**
 * Banner destination derived from targeting: a single category (and no
 * products) → that category; a single product (and no categories) → that
 * product; otherwise the whole store. The owner never picks this manually.
 */
function deriveDestination(targets: BuiltPromotion["targets"]): {
  dest_type: string;
  dest_category_id: string | null;
  dest_product_id: string | null;
} {
  const categories = [...new Set(targets.map((t) => t.category_id).filter(Boolean))];
  const products = [...new Set(targets.map((t) => t.product_id).filter(Boolean))];
  if (categories.length === 1 && products.length === 0) {
    return { dest_type: "category", dest_category_id: categories[0], dest_product_id: null };
  }
  if (products.length === 1 && categories.length === 0) {
    return { dest_type: "product", dest_category_id: null, dest_product_id: products[0] };
  }
  return { dest_type: "store", dest_category_id: null, dest_product_id: null };
}

async function syncTargets(
  supabase: SupabaseClient,
  promotionId: string,
  targets: BuiltPromotion["targets"],
): Promise<string | null> {
  const { error: deleteError } = await supabase
    .from("promotion_targets")
    .delete()
    .eq("promotion_id", promotionId);
  if (deleteError) return "We could not save the offer targeting.";
  if (targets.length > 0) {
    const { error } = await supabase
      .from("promotion_targets")
      .insert(targets.map((t) => ({ ...t, promotion_id: promotionId })));
    if (error) return "We could not save the offer targeting.";
  }
  return null;
}

async function syncCoupons(
  supabase: SupabaseClient,
  promotionId: string,
  codes: string[],
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("promotion_coupons")
    .select("id, code")
    .eq("promotion_id", promotionId);
  const rows = ((existing ?? []) as Row[]).filter((r) => typeof r.code === "string");
  const keep = new Set(codes);
  for (const row of rows) {
    if (!keep.has(row.code as string)) {
      const { error } = await supabase.from("promotion_coupons").delete().eq("id", row.id);
      if (error) return "We could not save the coupon codes.";
    }
  }
  const have = new Set(rows.map((r) => r.code as string));
  for (const code of codes) {
    if (have.has(code)) continue;
    const { error } = await supabase
      .from("promotion_coupons")
      .insert({ promotion_id: promotionId, code });
    if (error) {
      // Another promotion already claimed the code (global uniqueness).
      return `Coupon ${code} is already in use by another offer.`;
    }
  }
  return null;
}

async function storeBannerImage(
  supabase: SupabaseClient,
  promotionId: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  const checked = await validateImageUpload(file);
  if (!checked.ok) return { error: checked.error };
  const ext = checked.kind === "jpeg" ? "jpg" : checked.kind;
  const path = `banners/${promotionId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("store-assets").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { error: "We could not upload the banner image." };
  return { path };
}

async function removeBannerImage(supabase: SupabaseClient, path: string | null): Promise<void> {
  if (!path || path.includes("..")) return;
  await supabase.storage.from("store-assets").remove([path]);
}

/** Confirms an owner-picked gallery path really is a stored banner image. */
export async function verifyGalleryPath(supabase: SupabaseClient, path: string): Promise<boolean> {
  if (!GALLERY_PATH_PATTERN.test(path)) return false;
  const slash = path.lastIndexOf("/");
  const { data } = await supabase.storage
    .from("store-assets")
    .list(path.slice(0, slash), { limit: 100, search: path.slice(slash + 1) });
  return (data ?? []).some((entry) => entry.name === path.slice(slash + 1));
}

function bannerFile(formData: FormData): File | null {
  const file = formData.get("bannerImage");
  return file instanceof File && file.size > 0 ? file : null;
}

/** Creates an offer as a draft; activation is a separate explicit step. */
export async function createPromotionAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await requireOwner("/owner/offers");
  const parsed = parseForm(formData, promotionFormSchema, PROMOTION_FORM_FIELDS);
  if (!parsed.ok) return errorState("Please check the offer details.", parsed.fieldErrors);
  const data = parsed.data;

  const supabase = await createClient();
  const targets = buildTargets(data);
  const { valid: coupons } = parseCouponLines(data.couponsText);
  const dest = deriveDestination(targets);
  const missing = await verifyTargets(
    supabase,
    targets,
    dest.dest_category_id,
    dest.dest_product_id,
  );
  if (missing) return errorState(missing);

  const row = buildRow(data, session.user.id, "draft");
  row.dest_type = dest.dest_type;
  row.dest_category_id = dest.dest_category_id;
  row.dest_product_id = dest.dest_product_id;
  const { data: created, error } = await supabase
    .from("promotions")
    .insert(row)
    .select("id")
    .maybeSingle();
  const promotionId = (created as { id?: unknown } | null)?.id;
  if (error || typeof promotionId !== "string") {
    return errorState("We could not create the offer. Please try again.");
  }

  const rollback = async (): Promise<void> => {
    await supabase.from("promotions").delete().eq("id", promotionId);
  };

  const targetError = await syncTargets(supabase, promotionId, targets);
  if (targetError) {
    await rollback();
    return errorState(targetError);
  }
  const couponError = await syncCoupons(supabase, promotionId, coupons);
  if (couponError) {
    await rollback();
    return errorState(couponError);
  }
  await supabase
    .from("promotions")
    .update({ has_coupon: coupons.length > 0 })
    .eq("id", promotionId);

  const file = bannerFile(formData);
  if (file) {
    const uploaded = await storeBannerImage(supabase, promotionId, file);
    if (uploaded.error || !uploaded.path) {
      await rollback();
      return errorState(uploaded.error ?? "We could not upload the banner image.");
    }
    const { error: imageError } = await supabase
      .from("promotions")
      .update({ banner_image_path: uploaded.path })
      .eq("id", promotionId);
    if (imageError) {
      await removeBannerImage(supabase, uploaded.path);
      await rollback();
      return errorState("We could not save the banner image.");
    }
  } else if (data.galleryImagePath.trim().length > 0) {
    if (!(await verifyGalleryPath(supabase, data.galleryImagePath.trim()))) {
      await rollback();
      return errorState("That gallery image is no longer available.");
    }
    const { error: imageError } = await supabase
      .from("promotions")
      .update({ banner_image_path: data.galleryImagePath.trim() })
      .eq("id", promotionId);
    if (imageError) {
      await rollback();
      return errorState("We could not save the banner image.");
    }
  }

  await logEvent(supabase, promotionId, session.user.id, "created", { name: data.name });
  refreshOffers();
  redirect(`/owner/offers/${promotionId}`);
}

export async function updatePromotionAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await requireOwner("/owner/offers");
  const rawId = formData.get("id");
  const promotionId = typeof rawId === "string" && UUID_PATTERN.test(rawId) ? rawId : null;
  if (!promotionId) return errorState("That offer was not found.");

  const parsed = parseForm(formData, promotionFormSchema, PROMOTION_FORM_FIELDS);
  if (!parsed.ok) return errorState("Please check the offer details.", parsed.fieldErrors);
  const data = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("promotions")
    .select("id, banner_image_path, config, max_uses_global, max_uses_per_customer")
    .eq("id", promotionId)
    .maybeSingle();
  if (!current) return errorState("That offer was not found.");
  const currentRow = current as Row;

  const targets = buildTargets(data);
  const { valid: coupons } = parseCouponLines(data.couponsText);
  const dest = deriveDestination(targets);
  const missing = await verifyTargets(
    supabase,
    targets,
    dest.dest_category_id,
    dest.dest_product_id,
  );
  if (missing) return errorState(missing);

  const patch = buildRow(data, session.user.id, (currentRow.status as PromotionStatus) ?? "draft");
  delete (patch as Record<string, unknown>).created_by;
  patch.dest_type = dest.dest_type;
  patch.dest_category_id = dest.dest_category_id;
  patch.dest_product_id = dest.dest_product_id;

  const file = bannerFile(formData);
  if (file) {
    const uploaded = await storeBannerImage(supabase, promotionId, file);
    if (uploaded.error || !uploaded.path) return errorState(uploaded.error ?? "Upload failed.");
    patch.banner_image_path = uploaded.path;
  } else if (data.galleryImagePath.trim().length > 0) {
    if (!(await verifyGalleryPath(supabase, data.galleryImagePath.trim()))) {
      return errorState("That gallery image is no longer available.");
    }
    patch.banner_image_path = data.galleryImagePath.trim();
  } else if (data.removeBannerImage) {
    patch.banner_image_path = null;
  }
  const { error } = await supabase.from("promotions").update(patch).eq("id", promotionId);
  if (error) {
    if (file && typeof patch.banner_image_path === "string") {
      await removeBannerImage(supabase, patch.banner_image_path);
    }
    return errorState("We could not save the offer. Please try again.");
  }
  if (file) await removeBannerImage(supabase, currentRow.banner_image_path as string | null);
  if (data.removeBannerImage) {
    await removeBannerImage(supabase, currentRow.banner_image_path as string | null);
  }

  const targetError = await syncTargets(supabase, promotionId, targets);
  if (targetError) return errorState(targetError);
  const { data: beforeCoupons } = await supabase
    .from("promotion_coupons")
    .select("code")
    .eq("promotion_id", promotionId);
  const before = new Set(
    ((beforeCoupons ?? []) as Row[])
      .map((r) => r.code)
      .filter((c) => typeof c === "string") as string[],
  );
  const couponError = await syncCoupons(supabase, promotionId, coupons);
  if (couponError) return errorState(couponError);
  await supabase
    .from("promotions")
    .update({ has_coupon: coupons.length > 0 })
    .eq("id", promotionId);

  const events: string[] = ["updated"];
  const couponChanged = before.size !== coupons.length || coupons.some((code) => !before.has(code));
  if (couponChanged) events.push("coupon_changed");
  if (JSON.stringify(currentRow.config ?? {}) !== JSON.stringify(patch.config)) {
    events.push("eligibility_changed");
  }
  const bannerKeys = [
    "banner_header",
    "banner_title",
    "banner_description",
    "banner_cta_label",
    "banner_style",
    "banner_image_path",
    "dest_type",
    "dest_category_id",
    "dest_product_id",
  ] as const;
  const { data: after } = await supabase
    .from("promotions")
    .select(bannerKeys.join(","))
    .eq("id", promotionId)
    .maybeSingle();
  const afterRow = (after ?? {}) as Row;
  if (
    bannerKeys.some(
      (key) => JSON.stringify(currentRow[key] ?? null) !== JSON.stringify(afterRow[key] ?? null),
    ) ||
    file ||
    data.removeBannerImage
  ) {
    events.push("banner_changed");
  }
  for (const event of events) {
    await logEvent(supabase, promotionId, session.user.id, event, { name: data.name });
  }

  refreshOffers();
  return successState("Offer saved.");
}

export async function duplicatePromotionAction(promotionId: string): Promise<AuthFormState> {
  const session = await requireOwner("/owner/offers");
  if (!UUID_PATTERN.test(promotionId)) return errorState("That offer was not found.");
  const supabase = await createClient();
  const [{ data: promo }, { data: targetRows }] = await Promise.all([
    supabase.from("promotions").select("*").eq("id", promotionId).maybeSingle(),
    supabase.from("promotion_targets").select("*").eq("promotion_id", promotionId),
  ]);
  const source = promo as Row | null;
  if (!source || typeof source.name !== "string") return errorState("That offer was not found.");

  const copy: Row = { ...(source as object) };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  copy.name = `Copy of ${String(source.name).slice(0, 110)}`;
  copy.status = "draft";
  copy.uses_count = 0;
  copy.has_coupon = false;
  copy.starts_at = null;
  copy.ends_at = null;
  copy.banner_image_path = null;
  copy.created_by = session.user.id;
  const { data: created, error } = await supabase
    .from("promotions")
    .insert(copy)
    .select("id")
    .maybeSingle();
  const newId = (created as { id?: unknown } | null)?.id;
  if (error || typeof newId !== "string") {
    return errorState("We could not duplicate the offer.");
  }
  const targets = ((targetRows ?? []) as Row[]).map((row) => ({
    promotion_id: newId,
    target_type: row.target_type,
    target_role: row.target_role ?? "any",
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    product_id: typeof row.product_id === "string" ? row.product_id : null,
  }));
  if (targets.length > 0) {
    const { error: targetError } = await supabase.from("promotion_targets").insert(targets);
    if (targetError) {
      await supabase.from("promotions").delete().eq("id", newId);
      return errorState("We could not duplicate the offer targeting.");
    }
  }
  // Coupon codes stay unique globally, so copies start codeless by design.
  await logEvent(supabase, newId, session.user.id, "duplicated", { from: promotionId });
  refreshOffers();
  redirect(`/owner/offers/${newId}`);
}

const STATUS_EVENTS: Record<string, string> = {
  active: "activated",
  paused: "paused",
  archived: "archived",
};

export async function setPromotionStatusAction(
  promotionId: string,
  toStatus: PromotionStatus,
): Promise<AuthFormState> {
  const session = await requireOwner("/owner/offers");
  if (!UUID_PATTERN.test(promotionId)) return errorState("That offer was not found.");
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("promotions")
    .select("id, status")
    .eq("id", promotionId)
    .maybeSingle();
  const row = current as { status?: unknown } | null;
  if (!row || typeof row.status !== "string") return errorState("That offer was not found.");
  const from = row.status as PromotionStatus;
  if (!canTransitionStatus(from, toStatus)) {
    return errorState("That status change is not allowed for this offer.");
  }
  const { error } = await supabase
    .from("promotions")
    .update({ status: toStatus })
    .eq("id", promotionId);
  if (error) return errorState("We could not update the offer status.");
  await logEvent(supabase, promotionId, session.user.id, STATUS_EVENTS[toStatus] ?? "updated", {
    from,
    to: toStatus,
  });
  refreshOffers();
  return successState(`Offer ${toStatus}.`);
}

export async function deletePromotionAction(promotionId: string): Promise<AuthFormState> {
  const session = await requireOwner("/owner/offers");
  if (!UUID_PATTERN.test(promotionId)) return errorState("That offer was not found.");
  const supabase = await createClient();
  const [{ data: current }, { count: redemptions }] = await Promise.all([
    supabase
      .from("promotions")
      .select("id, name, status, banner_image_path")
      .eq("id", promotionId)
      .maybeSingle(),
    supabase
      .from("promotion_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promotion_id", promotionId),
  ]);
  const row = current as Row | null;
  if (!row) return errorState("That offer was not found.");
  if ((redemptions ?? 0) > 0) {
    return errorState("This offer has redemptions — archive it instead of deleting.");
  }
  if (row.status !== "draft" && row.status !== "archived") {
    return errorState("Only draft or archived offers can be deleted.");
  }
  await removeBannerImage(supabase, row.banner_image_path as string | null);
  const { error } = await supabase.from("promotions").delete().eq("id", promotionId);
  if (error) return errorState("We could not delete the offer.");
  await logEvent(supabase, null, session.user.id, "deleted", {
    name: typeof row.name === "string" ? row.name : "",
  });
  refreshOffers();
  redirect("/owner/offers");
}

// ---------------------------------------------------------------------------
// Customer coupon (saved on the cart; validated by the engine at quote time)
// ---------------------------------------------------------------------------

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

/**
 * Saves a coupon code on the caller's cart. Only the FORMAT is checked here;
 * existence, dates, limits and eligibility are evaluated server-side by the
 * promotion engine on every quote and at order creation, so nothing about
 * other codes is disclosed.
 */
export async function applyCouponAction(code: string): Promise<AuthFormState> {
  const session = await requireUser("/webstore");
  const normalized = normalizeCouponCode(code);
  if (!isValidCouponCode(normalized)) {
    return errorState("Check the coupon code and try again.");
  }
  const supabase = await createClient();
  const cartId = await getOrCreateCartId(supabase, session.user.id);
  if (!cartId) return errorState("We could not open your cart. Please try again.");
  const { error } = await supabase
    .from("carts")
    .update({ coupon_code: normalized })
    .eq("id", cartId)
    .eq("customer_id", session.user.id);
  if (error) return errorState("We could not apply the coupon. Please try again.");
  refreshOffers();
  return successState("Coupon saved — it applies if your order qualifies.");
}

export async function removeCouponAction(): Promise<AuthFormState> {
  const session = await requireUser("/webstore");
  const supabase = await createClient();
  const { error } = await supabase
    .from("carts")
    .update({ coupon_code: null })
    .eq("customer_id", session.user.id);
  if (error) return errorState("We could not remove the coupon. Please try again.");
  refreshOffers();
  return successState("Coupon removed.");
}
