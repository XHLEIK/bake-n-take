import { validateImageUpload } from "@/lib/store/validation";
import { istLocalToIso } from "@/lib/promotions/validation";
import { verifyGalleryPath } from "@/lib/promotions/actions";
import { createClient } from "@/lib/supabase/server";

/**
 * Product ↔ hero synchronization (Phase 5.1 §6–7, §17).
 *
 * The product form's "Feature in Hero Carousel" toggle is the switch; this
 * helper owns the single managed hero row (unique per product — featuring
 * can never duplicate records). Turning the toggle off pauses the row
 * instead of deleting it, so history and ordering survive. "Mark as New"
 * needs no row: the selector reads the product flags directly, and expiry
 * is automatic via new_until.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ProductHeroInput = {
  productId: string;
  featured: boolean;
  enabled: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  priority: number;
  startsAtLocal: string;
  endsAtLocal: string;
  galleryImagePath: string;
  imageFile: File | null;
  actorId: string;
};

export async function syncProductHeroSlide(
  supabase: SupabaseClient,
  input: ProductHeroInput,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("hero_items")
    .select("id, status, image_path")
    .eq("type", "product")
    .eq("product_id", input.productId)
    .eq("is_system", false)
    .maybeSingle();
  const row = existing as { id: string; status: string; image_path: string | null } | null;

  if (!input.featured) {
    // Pause, never delete: ordering and history survive untoggling.
    if (row && row.status !== "archived") {
      const { error } = await supabase
        .from("hero_items")
        .update({ status: "paused" })
        .eq("id", row.id);
      if (error) return "We could not update the hero slide.";
    }
    return null;
  }

  let imagePath: string | null = row?.image_path ?? null;
  if (input.imageFile) {
    const checked = await validateImageUpload(input.imageFile);
    if (!checked.ok) return checked.error;
    const ext = checked.kind === "jpeg" ? "jpg" : checked.kind;
    const path = `banners/hero/product/${input.productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, input.imageFile, {
      contentType: input.imageFile.type || undefined,
      upsert: false,
    });
    if (error) return "We could not upload the hero image.";
    if (row?.image_path) {
      await supabase.storage.from("store-assets").remove([row.image_path]);
    }
    imagePath = path;
  } else if (input.galleryImagePath.trim().length > 0) {
    if (!(await verifyGalleryPath(supabase, input.galleryImagePath.trim()))) {
      return "That gallery image is no longer available.";
    }
    imagePath = input.galleryImagePath.trim();
  }

  const payload = {
    type: "product",
    status: input.enabled ? "active" : "paused",
    display_order: 0,
    priority: input.priority,
    starts_at: istLocalToIso(input.startsAtLocal),
    ends_at: istLocalToIso(input.endsAtLocal),
    title: input.title.trim().length > 0 ? input.title.trim() : null,
    description: input.description.trim().length > 0 ? input.description.trim() : null,
    cta_label: input.ctaLabel.trim().length > 0 ? input.ctaLabel.trim() : null,
    image_path: imagePath,
    dest_type: "product",
    dest_category_id: null,
    dest_product_id: input.productId,
    promotion_id: null,
    product_id: input.productId,
    category_id: null,
    is_system: false,
    created_by: input.actorId,
  };

  if (row) {
    // Never resurrect archived rows from the product form; the hero
    // manager owns archival explicitly.
    const { error } = await supabase
      .from("hero_items")
      .update(row.status === "archived" ? { ...payload, status: "archived" } : payload)
      .eq("id", row.id);
    if (error) return "We could not update the hero slide.";
    return null;
  }
  const { error } = await supabase.from("hero_items").insert(payload);
  if (error) return "We could not feature the product in the hero.";
  return null;
}
