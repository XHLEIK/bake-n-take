"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";

import { errorState, successState, type AuthFormState } from "@/lib/auth/form-state";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateImageUpload } from "@/lib/store/validation";
import { parseForm } from "@/lib/validation/auth";

import { CATALOG_TAG } from "./repository";
import { slugify, uniqueSlug } from "./slug";
import { categorySchema, productSchema, type ProductInput } from "./validation";
import { syncProductHeroSlide } from "@/lib/hero/product-sync";
import { istLocalToIso } from "@/lib/promotions/validation";
import type { DesignUploadState } from "./types";

/**
 * Owner-only catalog write path (Phase 3).
 *
 * Every mutation starts with `requireOwner`, which re-reads the role from the
 * database profile — a customer posting here is bounced before validation or
 * storage is touched, and RLS independently rejects non-owner writes. Prices
 * are recomputed server-side from validated labels; client-sent totals are
 * never accepted (the forms do not even send one).
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const CUSTOMER_DESIGN_MAX_BYTES = 5 * 1024 * 1024;

function refreshCatalog(): void {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
}

function imageFiles(formData: FormData, name: string): File[] {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function removeStoragePaths(
  supabase: SupabaseClient,
  bucket: string,
  paths: (string | null | undefined)[],
): Promise<void> {
  const targets = paths.filter((path): path is string => !!path);
  if (targets.length === 0) return;
  await supabase.storage
    .from(bucket)
    .remove(targets)
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const CATEGORY_FIELDS = ["name"] as const;

async function categorySlug(supabase: SupabaseClient, name: string): Promise<string> {
  const { data } = await supabase.from("categories").select("slug");
  const taken = ((data ?? []) as { slug: string }[]).map((row) => row.slug);
  return uniqueSlug(name, taken);
}

export async function createCategoryAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireOwner("/owner/products");

  const parsed = parseForm(formData, categorySchema, CATEGORY_FIELDS);
  if (!parsed.ok) {
    return errorState("Please check the highlighted fields and try again.", parsed.fieldErrors);
  }
  const supabase = await createClient();

  // Resolve the slug before touching the insert chain: nesting the await
  // inside the insert arguments would start the outer chain first.
  const slug = await categorySlug(supabase, parsed.data.name);
  const { data: inserted, error } = await supabase
    .from("categories")
    .insert({ name: parsed.data.name, slug })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    return errorState("We could not create the category. Please try again.");
  }

  // No redirect: the console stays put and refreshes its own list.
  refreshCatalog();
  return successState("Category created.");
}

export async function updateCategoryAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireOwner("/owner/products");

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return errorState("That category was not found.");

  const parsed = parseForm(formData, categorySchema, CATEGORY_FIELDS);
  if (!parsed.ok) {
    return errorState("Please check the highlighted fields and try again.", parsed.fieldErrors);
  }
  const supabase = await createClient();

  // Slugs are minted once at creation and never regenerated: renames must not
  // break existing public URLs.
  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) return errorState("We could not save the category. Please try again.");

  refreshCatalog();
  return successState("Category saved.");
}

/**
 * Delete a category. Its products are never deleted: the database nulls
 * their category (ON DELETE SET NULL) and they show as uncategorized until
 * the owner reassigns them.
 */
export async function deleteCategoryAction(id: string): Promise<AuthFormState> {
  await requireOwner("/owner/products");
  const supabase = await createClient();

  const { data: removed, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !removed) return errorState("We could not delete the category. Please try again.");

  refreshCatalog();
  return successState("Category deleted. Its products are now uncategorized.");
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const PRODUCT_FIELDS = [
  "name",
  "shortDescription",
  "description",
  "basePriceRupees",
  "categoryId",
  "variantMode",
  "variantsJson",
  "flavoursJson",
  "isActive",
  "isFeatured",
  "isTrending",
  "allowCustomDesign",
  "eggEgglessEnabled",
  "egglessSurchargeRupees",
  "messageEnabled",
  "displayOrder",
  "prepHours",
  "isNew",
  "newUntil",
  "heroFeatured",
  "heroEnabled",
  "heroTitle",
  "heroDescription",
  "heroCta",
  "heroPriority",
  "heroStartsAt",
  "heroEndsAt",
  "heroGalleryPath",
] as const;

/** Converts an optional calendar date to end-of-day IST ISO (null when blank). */
function newUntilIso(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "invalid";
  const iso = istLocalToIso(`${trimmed}T23:59`);
  return iso ?? "invalid";
}

function heroImageFile(formData: FormData): File | null {
  const file = formData.get("heroImage");
  return file instanceof File && file.size > 0 ? file : null;
}

async function productSlug(supabase: SupabaseClient, name: string): Promise<string> {
  const root = slugify(name);
  const { data } = await supabase.from("products").select("slug").ilike("slug", `${root}%`);
  return uniqueSlug(
    root,
    ((data ?? []) as { slug: string }[]).map((row) => row.slug),
  );
}

/**
 * Verifies the assigned category exists. Null means uncategorized, which is
 * always allowed — the owner can reassign later.
 */
async function verifyCategory(
  supabase: SupabaseClient,
  categoryId: string | null,
): Promise<string | null> {
  if (categoryId === null) return null;
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category) return "Pick a category from the list, or leave it empty.";
  return null;
}

async function storeProductImage(
  supabase: SupabaseClient,
  productId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const checked = await validateImageUpload(file);
  if (!checked.ok) return checked;
  const ext = checked.kind === "jpeg" ? "jpg" : checked.kind;
  const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("store-assets").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { ok: false, error: "We could not upload an image. Please try again." };
  return { ok: true, path };
}

function withOrder<Row extends { id: string | null }>(
  rows: Row[],
): (Row & { displayOrder: number })[] {
  return rows.map((row, index) => ({ ...row, displayOrder: index }));
}

/**
 * Reconciles child rows by id: deletes rows the owner removed (scoped to this
 * product, so one product can never touch another's rows), updates the rest,
 * inserts the new. Display order follows the submitted sequence.
 */
async function syncChildren(
  supabase: SupabaseClient,
  table: "product_variants" | "product_flavours",
  productId: string,
  rows: { id: string | null; payload: Record<string, unknown> }[],
): Promise<string | null> {
  const { data: existing } = await supabase.from(table).select("id").eq("product_id", productId);
  const owned = new Set(((existing ?? []) as { id: string }[]).map((row) => row.id));
  const keep = new Set(
    rows.filter((row) => row.id && owned.has(row.id)).map((row) => row.id as string),
  );

  for (const row of owned) {
    if (!keep.has(row)) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", row)
        .eq("product_id", productId);
      if (error) return "We could not save the options. Please try again.";
    }
  }

  for (const [index, row] of rows.entries()) {
    const payload = { ...row.payload, display_order: index };
    if (row.id && owned.has(row.id)) {
      const { error } = await supabase
        .from(table)
        .update(payload)
        .eq("id", row.id)
        .eq("product_id", productId);
      if (error) return "We could not save the options. Please try again.";
    } else {
      const { error } = await supabase.from(table).insert({ ...payload, product_id: productId });
      if (error) return "We could not save the options. Please try again.";
    }
  }
  return null;
}

type ImageDraft = { id: string | null; altText: string; isPrimary: boolean; removed: boolean };

function parseImagesJson(value: FormDataEntryValue | null): ImageDraft[] | null {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      return {
        id: typeof record.id === "string" && record.id.length > 0 ? record.id : null,
        altText: typeof record.altText === "string" ? record.altText.slice(0, 160) : "",
        isPrimary: record.isPrimary === true,
        removed: record.removed === true,
      };
    });
  } catch {
    return null;
  }
}

async function syncImages(
  supabase: SupabaseClient,
  productId: string,
  drafts: ImageDraft[],
  newFiles: File[],
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("product_images")
    .select("id, storage_path")
    .eq("product_id", productId);
  const owned = new Map(
    ((existing ?? []) as { id: string; storage_path: string }[]).map((row) => [
      row.id,
      row.storage_path,
    ]),
  );

  const removedPaths: string[] = [];
  const kept: { id: string; altText: string; isPrimary: boolean; order: number }[] = [];
  for (const draft of drafts) {
    if (!draft.id || !owned.has(draft.id)) continue;
    if (draft.removed) {
      removedPaths.push(owned.get(draft.id) as string);
      const { error } = await supabase
        .from("product_images")
        .delete()
        .eq("id", draft.id)
        .eq("product_id", productId);
      if (error) return "We could not save the images. Please try again.";
    } else {
      kept.push({
        id: draft.id,
        altText: draft.altText,
        isPrimary: draft.isPrimary,
        order: kept.length,
      });
    }
  }

  const uploaded: { id: string; path: string }[] = [];
  for (const file of newFiles) {
    const stored = await storeProductImage(supabase, productId, file);
    if (!stored.ok) return stored.error;
    const { data: inserted, error } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        storage_path: stored.path,
        alt_text: "",
        display_order: kept.length + uploaded.length,
        is_primary: false,
      })
      .select("id")
      .maybeSingle();
    if (error || !inserted) {
      await removeStoragePaths(supabase, "store-assets", [stored.path]);
      return "We could not save the images. Please try again.";
    }
    uploaded.push({ id: (inserted as { id: string }).id, path: stored.path });
  }

  await removeStoragePaths(supabase, "store-assets", removedPaths);

  // Exactly one primary: the owner's pick wins, otherwise the first image.
  const all = [
    ...kept.map((row) => ({ id: row.id, isPrimary: row.isPrimary, order: row.order })),
    ...uploaded.map((row, index) => ({ id: row.id, isPrimary: false, order: kept.length + index })),
  ].sort((a, b) => a.order - b.order);
  if (all.length > 0) {
    const primaryId = all.find((row) => row.isPrimary)?.id ?? all[0].id;
    for (const [index, row] of all.entries()) {
      const { error } = await supabase
        .from("product_images")
        .update({
          display_order: index,
          is_primary: row.id === primaryId,
          ...(row.id && kept.find((keptRow) => keptRow.id === row.id)
            ? { alt_text: kept.find((keptRow) => keptRow.id === row.id)?.altText ?? "" }
            : {}),
        })
        .eq("id", row.id)
        .eq("product_id", productId);
      if (error) return "We could not save the images. Please try again.";
    }
  }
  return null;
}

export async function createProductAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await requireOwner("/owner/products");

  const parsed = parseForm(formData, productSchema, PRODUCT_FIELDS);
  if (!parsed.ok) {
    return errorState("Please check the highlighted fields and try again.", parsed.fieldErrors);
  }
  const data: ProductInput = parsed.data;
  const supabase = await createClient();

  const referenceError = await verifyCategory(supabase, data.categoryId);
  if (referenceError) return errorState(referenceError);

  const newUntil = newUntilIso(data.newUntil);
  if (newUntil === "invalid") {
    return errorState("Please check the highlighted fields and try again.", {
      newUntil: "Use a calendar date.",
    });
  }
  if (data.heroStartsAt.trim().length > 0 && istLocalToIso(data.heroStartsAt) === null) {
    return errorState("Please check the highlighted fields and try again.", {
      heroStartsAt: "Invalid start date.",
    });
  }
  if (data.heroEndsAt.trim().length > 0 && istLocalToIso(data.heroEndsAt) === null) {
    return errorState("Please check the highlighted fields and try again.", {
      heroEndsAt: "Invalid end date.",
    });
  }
  const heroStarts = istLocalToIso(data.heroStartsAt);
  const heroEnds = istLocalToIso(data.heroEndsAt);
  if (heroStarts && heroEnds && heroEnds <= heroStarts) {
    return errorState("Please check the highlighted fields and try again.", {
      heroEndsAt: "Hero end must be after start.",
    });
  }

  // The slug is minted once here and never regenerated on rename.
  const slug = await productSlug(supabase, data.name);
  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      name: data.name,
      slug,
      short_description: data.shortDescription,
      description: data.description,
      base_price_paise: data.basePriceRupees,
      category_id: data.categoryId,
      variant_mode: data.variantMode,
      is_active: data.isActive,
      is_featured: data.isFeatured,
      is_trending: data.isTrending,
      allow_custom_design: data.allowCustomDesign,
      egg_eggless_enabled: data.eggEgglessEnabled,
      eggless_surcharge_paise: data.egglessSurchargeRupees,
      message_enabled: data.messageEnabled,
      display_order: data.displayOrder,
      min_prep_minutes: data.prepHours,
      is_new: data.isNew,
      new_until: newUntil,
      hero_featured: data.heroFeatured,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) return errorState("We could not create the product. Please try again.");
  const productId = (inserted as { id: string }).id;

  const variants = withOrder(
    data.variantsJson.map((row) => ({
      id: row.id,
      payload: {
        label: row.label,
        value: row.value,
        price_paise: row.priceRupees,
        is_active: row.isActive,
      },
    })),
  );
  const variantError = await syncChildren(supabase, "product_variants", productId, variants);
  if (variantError) {
    await supabase.from("products").delete().eq("id", productId);
    return errorState(variantError);
  }

  const flavours = withOrder(
    data.flavoursJson.map((row) => ({
      id: row.id,
      payload: { name: row.name, surcharge_paise: row.surchargeRupees, is_active: row.isActive },
    })),
  );
  const flavourError = await syncChildren(supabase, "product_flavours", productId, flavours);
  if (flavourError) {
    await supabase.from("products").delete().eq("id", productId);
    return errorState(flavourError);
  }

  const imagesError = await syncImages(supabase, productId, [], imageFiles(formData, "newImages"));
  if (imagesError) {
    await supabase.from("products").delete().eq("id", productId);
    return errorState(imagesError);
  }

  const heroError = await syncProductHeroSlide(supabase, {
    productId,
    featured: data.heroFeatured,
    enabled: data.heroEnabled,
    title: data.heroTitle,
    description: data.heroDescription,
    ctaLabel: data.heroCta,
    priority: data.heroPriority,
    startsAtLocal: data.heroStartsAt,
    endsAtLocal: data.heroEndsAt,
    galleryImagePath: data.heroGalleryPath,
    imageFile: heroImageFile(formData),
    actorId: session.user.id,
  });
  if (heroError) {
    await supabase.from("products").delete().eq("id", productId);
    return errorState(heroError);
  }

  refreshCatalog();
  redirect(`/owner/products/${productId}`);
}

export async function updateProductAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await requireOwner("/owner/products");

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) return errorState("That product was not found.");

  const parsed = parseForm(formData, productSchema, PRODUCT_FIELDS);
  if (!parsed.ok) {
    return errorState("Please check the highlighted fields and try again.", parsed.fieldErrors);
  }
  const data: ProductInput = parsed.data;
  const supabase = await createClient();

  const { data: current } = await supabase.from("products").select("id").eq("id", id).maybeSingle();
  if (!current) return errorState("That product was not found.");

  const referenceError = await verifyCategory(supabase, data.categoryId);
  if (referenceError) return errorState(referenceError);

  const newUntil = newUntilIso(data.newUntil);
  if (newUntil === "invalid") {
    return errorState("Please check the highlighted fields and try again.", {
      newUntil: "Use a calendar date.",
    });
  }
  const heroStarts = istLocalToIso(data.heroStartsAt);
  const heroEnds = istLocalToIso(data.heroEndsAt);
  if (data.heroStartsAt.trim().length > 0 && heroStarts === null) {
    return errorState("Please check the highlighted fields and try again.", {
      heroStartsAt: "Invalid start date.",
    });
  }
  if (data.heroEndsAt.trim().length > 0 && heroEnds === null) {
    return errorState("Please check the highlighted fields and try again.", {
      heroEndsAt: "Invalid end date.",
    });
  }
  if (heroStarts && heroEnds && heroEnds <= heroStarts) {
    return errorState("Please check the highlighted fields and try again.", {
      heroEndsAt: "Hero end must be after start.",
    });
  }

  // The slug is stable for life: renames never break public URLs.
  const { error } = await supabase
    .from("products")
    .update({
      name: data.name,
      short_description: data.shortDescription,
      description: data.description,
      base_price_paise: data.basePriceRupees,
      category_id: data.categoryId,
      variant_mode: data.variantMode,
      is_active: data.isActive,
      is_featured: data.isFeatured,
      is_trending: data.isTrending,
      allow_custom_design: data.allowCustomDesign,
      egg_eggless_enabled: data.eggEgglessEnabled,
      eggless_surcharge_paise: data.egglessSurchargeRupees,
      message_enabled: data.messageEnabled,
      display_order: data.displayOrder,
      min_prep_minutes: data.prepHours,
      is_new: data.isNew,
      new_until: newUntil,
      hero_featured: data.heroFeatured,
    })
    .eq("id", id);
  if (error) return errorState("We could not save the product. Please try again.");

  const variants = withOrder(
    data.variantsJson.map((row) => ({
      id: row.id,
      payload: {
        label: row.label,
        value: row.value,
        price_paise: row.priceRupees,
        is_active: row.isActive,
      },
    })),
  );
  const variantError = await syncChildren(supabase, "product_variants", id, variants);
  if (variantError) return errorState(variantError);

  const flavours = withOrder(
    data.flavoursJson.map((row) => ({
      id: row.id,
      payload: { name: row.name, surcharge_paise: row.surchargeRupees, is_active: row.isActive },
    })),
  );
  const flavourError = await syncChildren(supabase, "product_flavours", id, flavours);
  if (flavourError) return errorState(flavourError);

  const drafts = parseImagesJson(formData.get("imagesJson"));
  if (drafts === null) return errorState("Those images are malformed.");
  const imagesError = await syncImages(supabase, id, drafts, imageFiles(formData, "newImages"));
  if (imagesError) return errorState(imagesError);

  const heroError = await syncProductHeroSlide(supabase, {
    productId: id,
    featured: data.heroFeatured,
    enabled: data.heroEnabled,
    title: data.heroTitle,
    description: data.heroDescription,
    ctaLabel: data.heroCta,
    priority: data.heroPriority,
    startsAtLocal: data.heroStartsAt,
    endsAtLocal: data.heroEndsAt,
    galleryImagePath: data.heroGalleryPath,
    imageFile: heroImageFile(formData),
    actorId: session.user.id,
  });
  if (heroError) return errorState(heroError);

  refreshCatalog();
  return successState("Product saved.");
}

/** Archive (or unarchive) — hidden from the catalog but kept for history. */
export async function setProductArchivedAction(
  id: string,
  archived: boolean,
): Promise<AuthFormState> {
  await requireOwner("/owner/products");
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return errorState("We could not update the product. Please try again.");
  refreshCatalog();
  return successState(archived ? "Product archived." : "Product restored.");
}

/** Quick availability toggle from the product list. */
export async function setProductActiveAction(id: string, active: boolean): Promise<AuthFormState> {
  await requireOwner("/owner/products");
  const supabase = await createClient();

  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", id);

  if (error) return errorState("We could not update the product. Please try again.");
  refreshCatalog();
  return successState(active ? "Product is available." : "Product marked unavailable.");
}

/**
 * Hard delete — allowed only because no order phase exists yet: children
 * cascade in the database and storage files are retired here. Phase 4 must
 * gate this on order references before historical orders can exist.
 */
export async function deleteProductAction(id: string): Promise<AuthFormState> {
  await requireOwner("/owner/products");
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return errorState("We could not delete the product. Please try again.");

  await removeStoragePaths(
    supabase,
    "store-assets",
    ((images ?? []) as { storage_path: string }[]).map((row) => row.storage_path),
  );
  refreshCatalog();
  redirect("/owner/products");
}

// ---------------------------------------------------------------------------
// Customer design drafts (no order is created — foundation only)
// ---------------------------------------------------------------------------

export async function uploadCustomerDesignAction(
  _previous: DesignUploadState,
  formData: FormData,
): Promise<DesignUploadState> {
  const session = await requireUser(`/webstore`);
  const supabase = await createClient();

  const [file] = imageFiles(formData, "design");
  if (!file) return { status: "error", message: "Choose an image first." };

  const checked = await validateImageUpload(file, CUSTOMER_DESIGN_MAX_BYTES);
  if (!checked.ok) return { status: "error", message: checked.error };

  const ext = checked.kind === "jpeg" ? "jpg" : checked.kind;
  const path = `tmp/${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("customer-designs").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error)
    return { status: "error", message: "We could not upload that image. Please try again." };
  return { status: "success", message: "Design attached.", path };
}

export async function removeCustomerDesignAction(path: string): Promise<DesignUploadState> {
  const session = await requireUser(`/webstore`);
  const prefix = `tmp/${session.user.id}/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    return { status: "error", message: "That design cannot be removed." };
  }

  const supabase = await createClient();
  const { error } = await supabase.storage.from("customer-designs").remove([path]);
  if (error)
    return { status: "error", message: "We could not remove that image. Please try again." };
  return { status: "success", message: "Design removed." };
}
