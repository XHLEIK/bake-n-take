"use server";

import { revalidatePath, updateTag } from "next/cache";

import { errorState, successState, type AuthFormState } from "@/lib/auth/form-state";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseForm } from "@/lib/validation/auth";

import { STORE_SETTINGS_TAG } from "./repository";
import { resolveAbout } from "./types";
import { storeSettingsSchema, validateImageUpload, type StoreSettingsInput } from "./validation";

/**
 * Owner-only Store Settings write path (Phase 2).
 *
 * `requireOwner` re-reads the role from the database profile, so a customer
 * who posts to this action is bounced before anything is validated or
 * written. Storage RLS independently restricts uploads to owners.
 */

const SETTINGS_FIELDS = [
  "storeName",
  "tagline",
  "description",
  "phonePrimary",
  "phoneSecondary",
  "email",
  "whatsapp",
  "addressLine1",
  "addressLine2",
  "locality",
  "city",
  "state",
  "postalCode",
  "country",
  "mapsUrl",
  "latitude",
  "longitude",
  "socialsJson",
  "hoursJson",
  "aboutJson",
  "pickupInstructions",
  "pickupLocation",
  "pickupNotes",
  "pickupEta",
  "isOpen",
  "acceptingOrders",
  "statusMessage",
  "heroMaxSlides",
  "currency",
  "currencySymbol",
  "timezone",
  "logoRemoved",
  "faviconRemoved",
  "aboutBannerRemoved",
] as const;

type UploadSlot = "logo" | "favicon" | "aboutBanner";

function storageFolder(slot: UploadSlot): string {
  if (slot === "logo") return "logos";
  if (slot === "favicon") return "favicons";
  return "banners/about";
}

function uploadLabel(slot: UploadSlot): string {
  return slot === "aboutBanner" ? "about banner" : slot;
}

function storageExtension(kind: "png" | "jpeg" | "webp"): string {
  return kind === "jpeg" ? "jpg" : kind;
}

/**
 * Validates and stores one image, returning the storage path. Old files are
 * removed by the caller after the settings row updates, so a failed save
 * never orphans the previous logo.
 */
async function storeImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  slot: UploadSlot,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const checked = await validateImageUpload(file);
  if (!checked.ok) return checked;

  const name = `${storageFolder(slot)}/${crypto.randomUUID()}.${storageExtension(checked.kind)}`;
  const { error } = await supabase.storage
    .from("store-assets")
    .upload(name, file, { contentType: file.type || undefined, upsert: false });

  if (error)
    return { ok: false, error: `We could not upload the ${uploadLabel(slot)}. Please try again.` };
  return { ok: true, path: name };
}

async function removeImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<void> {
  if (!path || path.includes("..")) return;
  await supabase.storage
    .from("store-assets")
    .remove([path])
    .catch(() => undefined);
}

function imageInput(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Saves the whole settings form atomically: validate → upload → update → revalidate. */
export async function updateStoreSettingsAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireOwner("/owner/settings");

  const parsed = parseForm(formData, storeSettingsSchema, SETTINGS_FIELDS);
  if (!parsed.ok) {
    return errorState("Please check the highlighted fields and try again.", parsed.fieldErrors);
  }
  const data: StoreSettingsInput = parsed.data;

  const supabase = await createClient();

  // Current paths, so replaced/removed files can be cleaned up afterwards.
  // If the row itself is unreadable we must stop here: proceeding with
  // nulled paths would wipe the stored logo, favicon and banner on save.
  const { data: current, error: currentError } = await supabase
    .from("store_settings")
    .select("logo_path, favicon_path, about")
    .eq("id", 1)
    .maybeSingle();
  if (currentError) {
    return errorState(
      "We could not load the current store settings. Check your connection and try again — if this keeps happening, the database may need an update.",
    );
  }

  const currentAbout = resolveAbout(
    current && typeof current === "object" ? (current as Record<string, unknown>).about : null,
  );

  const staged: { logo: string | null; favicon: string | null; aboutBanner: string | null } = {
    logo: typeof current?.logo_path === "string" ? current.logo_path : null,
    favicon: typeof current?.favicon_path === "string" ? current.favicon_path : null,
    aboutBanner: currentAbout.bannerPath,
  };
  const uploaded: string[] = [];

  const removalFlags = {
    logo: data.logoRemoved,
    favicon: data.faviconRemoved,
    aboutBanner: data.aboutBannerRemoved,
  } as const;

  for (const slot of ["logo", "favicon", "aboutBanner"] as const) {
    const file = imageInput(formData, slot === "aboutBanner" ? "aboutBanner" : slot);
    const removed = removalFlags[slot] === "1";
    if (file) {
      const stored = await storeImage(supabase, file, slot);
      if (!stored.ok) return errorState(stored.error);
      staged[slot] = stored.path;
      uploaded.push(stored.path);
    } else if (removed) {
      staged[slot] = null;
    }
  }

  // Submitted copy wins; an absent aboutJson keeps the stored section
  // untouched (old clients, partial posts). Either way the banner file
  // staged above decides banner_path.
  const submitted = data.aboutJson.keep ? null : data.aboutJson.data;
  const about = {
    enabled: submitted?.enabled ?? currentAbout.enabled,
    eyebrow: submitted?.eyebrow ?? currentAbout.eyebrow,
    heading: submitted?.heading ?? currentAbout.heading,
    body: submitted?.body ?? currentAbout.body,
    secondary: submitted?.secondary ?? currentAbout.secondary,
    cta_label: submitted?.cta_label ?? currentAbout.ctaLabel,
    cta_href: submitted?.cta_href ?? currentAbout.ctaHref,
    banner: submitted?.banner ?? currentAbout.banner,
    banner_path: staged.aboutBanner,
  };

  const previousPaths = [current?.logo_path, current?.favicon_path, currentAbout.bannerPath].filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );

  const { error } = await supabase
    .from("store_settings")
    .update({
      store_name: data.storeName,
      tagline: data.tagline,
      description: data.description,
      logo_path: staged.logo,
      favicon_path: staged.favicon,
      phone_primary: data.phonePrimary,
      phone_secondary: data.phoneSecondary,
      email: data.email,
      whatsapp: data.whatsapp,
      address_line1: data.addressLine1,
      address_line2: data.addressLine2,
      locality: data.locality,
      city: data.city,
      state: data.state,
      postal_code: data.postalCode,
      country: data.country,
      maps_url: data.mapsUrl,
      latitude: data.latitude,
      longitude: data.longitude,
      socials: data.socialsJson,
      hours: data.hoursJson,
      about: {
        enabled: about.enabled,
        eyebrow: about.eyebrow,
        heading: about.heading,
        body: about.body,
        secondary: about.secondary,
        cta_label: about.cta_label,
        cta_href: about.cta_href,
        banner: about.banner,
        banner_path: about.banner_path,
      },
      pickup_instructions: data.pickupInstructions,
      pickup_location: data.pickupLocation,
      pickup_notes: data.pickupNotes,
      pickup_eta: data.pickupEta,
      is_open: data.isOpen,
      accepting_orders: data.acceptingOrders,
      status_message: data.statusMessage,
      hero_max_slides: data.heroMaxSlides,
      currency: data.currency,
      currency_symbol: data.currencySymbol,
      timezone: data.timezone,
    })
    .eq("id", 1);

  if (error) {
    // Roll back newly uploaded files so a failed save leaves no orphans.
    await supabase.storage
      .from("store-assets")
      .remove(uploaded)
      .catch(() => undefined);
    return errorState("We could not save the store settings. Please try again.");
  }

  // Retire files the owner replaced or removed.
  const livePaths = new Set([staged.logo, staged.favicon, staged.aboutBanner]);
  for (const path of previousPaths) {
    if (!livePaths.has(path)) await removeImage(supabase, path);
  }

  // Immediate tag invalidation (read-your-own-writes in this action) plus a
  // layout-tree revalidation so every branded page re-renders on next visit.
  updateTag(STORE_SETTINGS_TAG);
  revalidatePath("/", "layout");
  return successState("Store settings saved.");
}
