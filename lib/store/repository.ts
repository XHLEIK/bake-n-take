import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { unstable_cache } from "next/cache";

import { supabaseConfig } from "@/lib/env";

import { mapSettingsRow, type StoreSettings } from "./types";

export const STORE_SETTINGS_TAG = "store-settings";

/**
 * Centralized Store Settings data layer (Phase 2).
 *
 * Component → this module → Supabase. No component queries store settings
 * directly.
 *
 * Retrieval strategy: the singleton row changes rarely but is read on nearly
 * every page, so it is cached across requests with `unstable_cache` (tag +
 * hourly revalidation as a backstop) and deduplicated within a request with
 * React `cache()`. Owner updates revalidate the tag immediately, so no
 * redeploy is ever needed for a settings change.
 *
 * The read uses a key-only client (no cookies, no session): the anonymous RLS
 * policy is the access rule, and there is nothing user-specific to leak
 * between requests. Failures resolve to null — callers render neutral states,
 * never hardcoded branding.
 */

const SETTINGS_COLUMNS = [
  "store_name",
  "tagline",
  "description",
  "logo_path",
  "favicon_path",
  "phone_primary",
  "phone_secondary",
  "email",
  "whatsapp",
  "address_line1",
  "address_line2",
  "locality",
  "city",
  "state",
  "postal_code",
  "country",
  "maps_url",
  "latitude",
  "longitude",
  "socials",
  "hours",
  "about",
  "pickup_instructions",
  "pickup_location",
  "pickup_notes",
  "pickup_eta",
  "is_open",
  "accepting_orders",
  "status_message",
  "hero_max_slides",
  "currency",
  "currency_symbol",
  "timezone",
  "updated_at",
];

/** Pre-Phase-7 shape: everything except the `about` column. */
const SETTINGS_COLUMNS_WITHOUT_ABOUT = SETTINGS_COLUMNS.filter((column) => column !== "about");

type SettingsRowResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

async function fetchSettingsRow(columns: string): Promise<SettingsRowResult> {
  const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("store_settings")
    .select(columns)
    .eq("id", 1)
    .maybeSingle();
  return { data, error: (error ?? null) as SettingsRowResult["error"] };
}

const fetchStoreSettings = unstable_cache(
  async (): Promise<StoreSettings | null> => {
    try {
      const first = await fetchSettingsRow(SETTINGS_COLUMNS.join(","));
      if (!first.error && first.data) {
        return mapSettingsRow(first.data as unknown as Record<string, unknown>);
      }
      // Graceful degradation: databases without the Phase 7 `about`
      // column (migration not yet applied) still serve every other
      // setting — About falls back to compiled defaults instead of
      // taking the whole storefront (name, logo, hours…) offline.
      // PostgREST reports a missing column as Postgres 42703; any other
      // failure keeps the existing fail-soft null.
      if (!first.error || first.error.code !== "42703") return null;
      const second = await fetchSettingsRow(SETTINGS_COLUMNS_WITHOUT_ABOUT.join(","));
      if (second.error || !second.data) return null;
      return mapSettingsRow(second.data as unknown as Record<string, unknown>);
    } catch {
      return null;
    }
  },
  ["store-settings-singleton"],
  { tags: [STORE_SETTINGS_TAG], revalidate: 3600 },
);

export const getStoreSettings = cache((): Promise<StoreSettings | null> => fetchStoreSettings());

/** Public URL for a path in the `store-assets` bucket. Null stays null. */
export function storeAssetUrl(path: string | null): string | null {
  if (!path) return null;
  const clean = path.replace(/^\/+/, "");
  return `${supabaseConfig.url.replace(/\/+$/, "")}/storage/v1/object/public/store-assets/${clean}`;
}

/** "Line 1, Locality, City PIN" from whichever parts exist. Null when empty. */
export function formatAddress(
  settings: Pick<
    StoreSettings,
    "addressLine1" | "addressLine2" | "locality" | "city" | "state" | "postalCode" | "country"
  >,
): string | null {
  const head = [settings.addressLine1, settings.addressLine2, settings.locality].filter(Boolean);
  const tail = [settings.city, settings.state, settings.postalCode].filter(Boolean);
  const lines = [...head, tail.join(" "), settings.country].map((part) => part?.trim());
  const formatted = lines.filter((part) => part && part.length > 0).join(", ");
  return formatted.length > 0 ? formatted : null;
}
