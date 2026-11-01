"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, successState, type AuthFormState } from "@/lib/auth/form-state";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseForm } from "@/lib/validation/auth";
import { validateImageUpload } from "@/lib/store/validation";
import { GALLERY_PATH_PATTERN, istLocalToIso } from "@/lib/promotions/validation";

import { canTransitionStatus } from "@/lib/promotions/status";
import { heroFormSchema, HERO_FORM_FIELDS } from "./validation";
import type { HeroStatus } from "./types";

/**
 * Hero mutations (Phase 5.1).
 *
 * Every export starts with requireOwner; RLS owner policies are the second
 * layer. Status transitions reuse the promotion lifecycle map. Reordering
 * swaps display_order with the adjacent sibling — deterministic, no drag
 * state. Images reuse the banner pipeline (upload + verified gallery).
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshHero(): void {
  revalidatePath("/", "layout");
}

function bannerFile(formData: FormData): File | null {
  const file = formData.get("heroImage");
  return file instanceof File && file.size > 0 ? file : null;
}

async function storeHeroImage(
  supabase: SupabaseClient,
  heroId: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  const checked = await validateImageUpload(file);
  if (!checked.ok) return { error: checked.error };
  const ext = checked.kind === "jpeg" ? "jpg" : checked.kind;
  const path = `banners/hero/${heroId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("store-assets").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { error: "We could not upload the hero image." };
  return { path };
}

async function removeHeroImage(supabase: SupabaseClient, path: string | null): Promise<void> {
  if (!path || path.includes("..")) return;
  await supabase.storage.from("store-assets").remove([path]);
}

async function verifyGalleryPath(supabase: SupabaseClient, path: string): Promise<boolean> {
  if (!GALLERY_PATH_PATTERN.test(path)) return false;
  const slash = path.lastIndexOf("/");
  const { data } = await supabase.storage
    .from("store-assets")
    .list(path.slice(0, slash), { limit: 100, search: path.slice(slash + 1) });
  return (data ?? []).some((entry) => entry.name === path.slice(slash + 1));
}

/** Confirms a source row exists (curated errors; availability is checked at display). */
async function verifySource(
  supabase: SupabaseClient,
  table: "promotions" | "products" | "categories",
  id: string | null,
  message: string,
): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  if (!data) return message;
  return null;
}

async function verifyDestination(
  supabase: SupabaseClient,
  destType: string,
  destCategoryId: string,
  destProductId: string,
): Promise<string | null> {
  if (destType === "category") {
    return verifySource(
      supabase,
      "categories",
      destCategoryId,
      "That destination category is gone.",
    );
  }
  if (destType === "product") {
    return verifySource(supabase, "products", destProductId, "That destination product is gone.");
  }
  return null;
}

export async function createHeroItemAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await requireOwner("/owner/hero");
  const parsed = parseForm(formData, heroFormSchema, HERO_FORM_FIELDS);
  if (!parsed.ok) return errorState("Please check the slide details.", parsed.fieldErrors);
  const data = parsed.data;
  if (data.type === "system") return errorState("System slides are managed, not created.");

  const supabase = await createClient();
  const sourceError =
    (await verifySource(supabase, "promotions", data.promotionId, "That offer is gone.")) ??
    (await verifySource(supabase, "products", data.productId, "That product is gone.")) ??
    (await verifySource(supabase, "categories", data.categoryId, "That category is gone.")) ??
    (await verifyDestination(supabase, data.destType, data.destCategoryId, data.destProductId));
  if (sourceError) return errorState(sourceError);

  // One hero row per product — re-featuring reuses the row, never duplicates.
  if (data.type === "product" && data.productId) {
    const { data: existing } = await supabase
      .from("hero_items")
      .select("id")
      .eq("type", "product")
      .eq("product_id", data.productId)
      .eq("is_system", false)
      .maybeSingle();
    if (existing) return errorState("This product already has a hero slide — edit it instead.");
  }

  const { data: created, error } = await supabase
    .from("hero_items")
    .insert({
      type: data.type,
      status: "draft",
      display_order: data.displayOrder,
      priority: data.priority,
      starts_at: istLocalToIso(data.startsAt),
      ends_at: istLocalToIso(data.endsAt),
      title: data.title.trim().length > 0 ? data.title.trim() : null,
      description: data.description.trim().length > 0 ? data.description.trim() : null,
      cta_label: data.ctaLabel.trim().length > 0 ? data.ctaLabel.trim() : null,
      dest_type: data.type === "announcement" || data.type === "campaign" ? data.destType : "store",
      dest_category_id:
        (data.type === "announcement" || data.type === "campaign") && data.destType === "category"
          ? data.destCategoryId
          : null,
      dest_product_id:
        (data.type === "announcement" || data.type === "campaign") && data.destType === "product"
          ? data.destProductId
          : null,
      promotion_id: data.type === "offer" ? data.promotionId : null,
      product_id: data.type === "product" ? data.productId : null,
      category_id: data.type === "category" ? data.categoryId : null,
      is_system: false,
      created_by: session.user.id,
    })
    .select("id")
    .maybeSingle();
  const heroId = (created as { id?: unknown } | null)?.id;
  if (error || typeof heroId !== "string") {
    return errorState("We could not create the slide. Please try again.");
  }

  const rollback = async (): Promise<void> => {
    await supabase.from("hero_items").delete().eq("id", heroId);
  };

  const file = bannerFile(formData);
  if (file) {
    const uploaded = await storeHeroImage(supabase, heroId, file);
    if (uploaded.error || !uploaded.path) {
      await rollback();
      return errorState(uploaded.error ?? "We could not upload the hero image.");
    }
    const { error: imageError } = await supabase
      .from("hero_items")
      .update({ image_path: uploaded.path })
      .eq("id", heroId);
    if (imageError) {
      await removeHeroImage(supabase, uploaded.path);
      await rollback();
      return errorState("We could not save the hero image.");
    }
  } else if (data.galleryImagePath.trim().length > 0) {
    if (!(await verifyGalleryPath(supabase, data.galleryImagePath.trim()))) {
      await rollback();
      return errorState("That gallery image is no longer available.");
    }
    const { error: imageError } = await supabase
      .from("hero_items")
      .update({ image_path: data.galleryImagePath.trim() })
      .eq("id", heroId);
    if (imageError) {
      await rollback();
      return errorState("We could not save the hero image.");
    }
  }

  refreshHero();
  redirect(`/owner/hero/${heroId}`);
}

export async function updateHeroItemAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireOwner("/owner/hero");
  const rawId = formData.get("id");
  const heroId = typeof rawId === "string" && UUID_PATTERN.test(rawId) ? rawId : null;
  if (!heroId) return errorState("That slide was not found.");

  const parsed = parseForm(formData, heroFormSchema, HERO_FORM_FIELDS);
  if (!parsed.ok) return errorState("Please check the slide details.", parsed.fieldErrors);
  const data = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("hero_items")
    .select("id, type, status, image_path, is_system")
    .eq("id", heroId)
    .maybeSingle();
  const currentRow = current as Row | null;
  if (!currentRow) return errorState("That slide was not found.");
  if (data.type !== currentRow.type) {
    return errorState("A slide cannot change its content type — create a new one.");
  }

  const sourceError =
    (await verifySource(supabase, "promotions", data.promotionId, "That offer is gone.")) ??
    (await verifySource(supabase, "products", data.productId, "That product is gone.")) ??
    (await verifySource(supabase, "categories", data.categoryId, "That category is gone.")) ??
    (await verifyDestination(supabase, data.destType, data.destCategoryId, data.destProductId));
  if (sourceError) return errorState(sourceError);

  if (data.type === "product" && data.productId) {
    const { data: clash } = await supabase
      .from("hero_items")
      .select("id")
      .eq("type", "product")
      .eq("product_id", data.productId)
      .eq("is_system", false)
      .neq("id", heroId)
      .maybeSingle();
    if (clash) return errorState("Another slide already features this product.");
  }

  const patch: Record<string, unknown> = {
    display_order: data.displayOrder,
    priority: data.priority,
    starts_at: istLocalToIso(data.startsAt),
    ends_at: istLocalToIso(data.endsAt),
    title: data.title.trim().length > 0 ? data.title.trim() : null,
    description: data.description.trim().length > 0 ? data.description.trim() : null,
    cta_label: data.ctaLabel.trim().length > 0 ? data.ctaLabel.trim() : null,
    dest_type: data.type === "announcement" || data.type === "campaign" ? data.destType : "store",
    dest_category_id:
      (data.type === "announcement" || data.type === "campaign") && data.destType === "category"
        ? data.destCategoryId
        : null,
    dest_product_id:
      (data.type === "announcement" || data.type === "campaign") && data.destType === "product"
        ? data.destProductId
        : null,
    promotion_id: data.type === "offer" ? data.promotionId : null,
    product_id: data.type === "product" ? data.productId : null,
    category_id: data.type === "category" ? data.categoryId : null,
  };

  const file = bannerFile(formData);
  if (file) {
    const uploaded = await storeHeroImage(supabase, heroId, file);
    if (uploaded.error || !uploaded.path) return errorState(uploaded.error ?? "Upload failed.");
    patch.image_path = uploaded.path;
  } else if (data.galleryImagePath.trim().length > 0) {
    if (!(await verifyGalleryPath(supabase, data.galleryImagePath.trim()))) {
      return errorState("That gallery image is no longer available.");
    }
    patch.image_path = data.galleryImagePath.trim();
  } else if (data.removeImage) {
    patch.image_path = null;
  }
  const { error } = await supabase.from("hero_items").update(patch).eq("id", heroId);
  if (error) {
    if (file && typeof patch.image_path === "string") {
      await removeHeroImage(supabase, patch.image_path);
    }
    return errorState("We could not save the slide. Please try again.");
  }
  if (file || data.galleryImagePath.trim().length > 0 || data.removeImage) {
    await removeHeroImage(supabase, currentRow.image_path as string | null);
  }

  refreshHero();
  return successState("Slide saved.");
}

const STATUS_EVENTS: Record<string, string> = {
  active: "activated",
  paused: "paused",
  archived: "archived",
};

export async function setHeroStatusAction(
  heroId: string,
  toStatus: HeroStatus,
): Promise<AuthFormState> {
  await requireOwner("/owner/hero");
  if (!UUID_PATTERN.test(heroId)) return errorState("That slide was not found.");
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("hero_items")
    .select("id, status")
    .eq("id", heroId)
    .maybeSingle();
  const row = current as { status?: unknown } | null;
  if (!row || typeof row.status !== "string") return errorState("That slide was not found.");
  if (!canTransitionStatus(row.status as HeroStatus, toStatus)) {
    return errorState("That status change is not allowed for this slide.");
  }
  const { error } = await supabase.from("hero_items").update({ status: toStatus }).eq("id", heroId);
  if (error) return errorState("We could not update the slide status.");
  refreshHero();
  return successState(`Slide ${STATUS_EVENTS[toStatus] ?? toStatus}.`);
}

/** Swaps display_order with the adjacent sibling in manual order. */
export async function moveHeroItemAction(
  heroId: string,
  direction: "up" | "down",
): Promise<AuthFormState> {
  await requireOwner("/owner/hero");
  if (!UUID_PATTERN.test(heroId)) return errorState("That slide was not found.");
  const supabase = await createClient();
  const { data } = await supabase
    .from("hero_items")
    .select("id, display_order")
    .order("display_order")
    .order("created_at")
    .limit(200);
  const rows = ((data ?? []) as { id: string; display_order: number }[]).filter(
    (r) => typeof r.id === "string",
  );
  const index = rows.findIndex((r) => r.id === heroId);
  const sibling = direction === "up" ? rows[index - 1] : rows[index + 1];
  if (index < 0 || !sibling) return errorState("Nothing to reorder there.");
  const current = rows[index];
  const { error: first } = await supabase
    .from("hero_items")
    .update({ display_order: sibling.display_order })
    .eq("id", current.id);
  if (first) return errorState("We could not reorder the slides.");
  // Sequential writes; display_order is not unique so no collision handling
  // is needed, and the failure path restores the original value.
  const { error: second } = await supabase
    .from("hero_items")
    .update({ display_order: current.display_order })
    .eq("id", sibling.id);
  if (second) {
    await supabase
      .from("hero_items")
      .update({ display_order: current.display_order })
      .eq("id", current.id);
    return errorState("We could not reorder the slides.");
  }
  refreshHero();
  return successState("Slides reordered.");
}

export async function duplicateHeroItemAction(heroId: string): Promise<AuthFormState> {
  const session = await requireOwner("/owner/hero");
  if (!UUID_PATTERN.test(heroId)) return errorState("That slide was not found.");
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("hero_items")
    .select("*")
    .eq("id", heroId)
    .maybeSingle();
  const row = source as Row | null;
  if (!row || row.is_system) return errorState("That slide was not found.");
  const copy: Row = { ...(row as object) };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  copy.status = "draft";
  copy.display_order = ((row.display_order as number) ?? 0) + 1;
  copy.image_path = null;
  copy.created_by = session.user.id;
  const { data: inserted, error } = await supabase
    .from("hero_items")
    .insert(copy)
    .select("id")
    .maybeSingle();
  const newId = (inserted as { id?: unknown } | null)?.id;
  if (error || typeof newId !== "string") {
    return errorState("We could not duplicate the slide.");
  }
  refreshHero();
  redirect(`/owner/hero/${newId}`);
}

export async function deleteHeroItemAction(heroId: string): Promise<AuthFormState> {
  await requireOwner("/owner/hero");
  if (!UUID_PATTERN.test(heroId)) return errorState("That slide was not found.");
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("hero_items")
    .select("id, status, image_path, is_system")
    .eq("id", heroId)
    .maybeSingle();
  const row = current as Row | null;
  if (!row || row.is_system) return errorState("That slide was not found.");
  if (row.status !== "draft" && row.status !== "archived") {
    return errorState("Only draft or archived slides can be deleted.");
  }
  await removeHeroImage(supabase, row.image_path as string | null);
  const { error } = await supabase.from("hero_items").delete().eq("id", heroId);
  if (error) return errorState("We could not delete the slide.");
  refreshHero();
  redirect("/owner/hero");
}
