/**
 * Store settings application model (Phase 2).
 *
 * Mirrors `public.store_settings` (singleton row, id = 1). Every column is
 * intentionally public — RLS exposes the whole row to anonymous visitors, so
 * secrets or internal configuration must never be added to this table.
 *
 * `socials` and `hours` are schemaless jsonb in the database so platforms and
 * schedules can grow without migrations. Their shapes are pinned here and
 * enforced by zod in `./validation`; anything else is rejected at the trust
 * boundary.
 */

export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

/** One day: either closed, or open between two HH:MM times. */
export type DayHours = {
  open: boolean;
  opens_at: string;
  closes_at: string;
};

export type WeekHours = Record<WeekDay, DayHours>;

/** Known platforms plus owner-defined extras. Unknown keys never render. */
export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  extra?: { label: string; url: string }[];
};

/**
 * Built-in About banner choices. These are the seeded `banners/predefined-*`
 * storage objects (see scripts/seed-hero-images.mjs) — real files in the
 * existing `store-assets` bucket, never hotlinks or invented URLs.
 */
export const ABOUT_BANNERS = [
  { key: "bread", label: "Artisan bread", path: "banners/predefined-bread.jpg" },
  { key: "cupcakes", label: "Fresh cupcakes", path: "banners/predefined-cupcakes.jpg" },
  {
    key: "chocolate-cake",
    label: "Celebration cake",
    path: "banners/predefined-chocolate-cake.jpg",
  },
  { key: "cookies", label: "Cookies", path: "banners/predefined-cookies.jpg" },
  { key: "macarons", label: "Macarons", path: "banners/predefined-macarons.jpg" },
  { key: "berry-cake", label: "Berry cake", path: "banners/predefined-berry-cake.jpg" },
] as const;

export type AboutBannerKey = (typeof ABOUT_BANNERS)[number]["key"];

export function isAboutBannerKey(value: unknown): value is AboutBannerKey {
  return ABOUT_BANNERS.some((entry) => entry.key === value);
}

export function aboutBannerPath(key: unknown): string {
  const found = ABOUT_BANNERS.find((entry) => entry.key === key);
  return found ? found.path : ABOUT_BANNERS[0].path;
}

/**
 * Owner-editable About Us section (Phase 7).
 *
 * Stored as one `about` jsonb object on the singleton row. `bannerPath` is
 * a custom uploaded `banners/about/…` storage path; when null the `banner`
 * key selects a built-in default. `cta_href` is either an internal path
 * ("/shop") resolved against the customer webstore, or a full http(s) URL.
 */
export type AboutSettings = {
  enabled: boolean;
  eyebrow: string;
  heading: string;
  body: string;
  secondary: string;
  ctaLabel: string;
  ctaHref: string;
  banner: AboutBannerKey;
  bannerPath: string | null;
};

/** Complete section out of the box — existing stores need zero setup. */
export const DEFAULT_ABOUT: AboutSettings = {
  enabled: true,
  eyebrow: "Baked with patience",
  heading: "Made fresh, shared with love.",
  body: "At Bake n Take, every bake starts with a little patience and a lot of care. From soft cupcakes and celebration cakes to comforting brownies and sweet little treats, we make each order with the simple idea that good things are worth taking your time for.",
  secondary: "Freshly baked in small batches, made for everyday cravings and special moments.",
  ctaLabel: "Explore the bake list",
  ctaHref: "/shop",
  banner: "bread",
  bannerPath: null,
};

function asAboutText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

/**
 * Merges stored About content over the compiled defaults, field by field.
 * Missing, malformed or emptied essentials fall back to defaults (an empty
 * secondary line stays empty — it simply doesn't render). Never throws.
 */
export function resolveAbout(value: unknown): AboutSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_ABOUT };
  const record = value as Record<string, unknown>;
  const ctaHref =
    typeof record.cta_href === "string" && record.cta_href.trim().length > 0
      ? record.cta_href.trim()
      : DEFAULT_ABOUT.ctaHref;
  const bannerPath =
    typeof record.banner_path === "string" &&
    record.banner_path.length > 0 &&
    record.banner_path.length <= 500 &&
    record.banner_path.startsWith("banners/") &&
    !record.banner_path.includes("..")
      ? record.banner_path
      : null;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    eyebrow: asAboutText(record.eyebrow, DEFAULT_ABOUT.eyebrow),
    heading: asAboutText(record.heading, DEFAULT_ABOUT.heading),
    body: asAboutText(record.body, DEFAULT_ABOUT.body),
    secondary: typeof record.secondary === "string" ? record.secondary : DEFAULT_ABOUT.secondary,
    ctaLabel: asAboutText(record.cta_label, DEFAULT_ABOUT.ctaLabel),
    ctaHref: /^(\/|https?:\/\/)/.test(ctaHref) ? ctaHref : DEFAULT_ABOUT.ctaHref,
    banner: isAboutBannerKey(record.banner) ? record.banner : DEFAULT_ABOUT.banner,
    bannerPath,
  };
}

/**
 * Resolves the About CTA against the customer webstore. Internal paths
 * ("/shop") stay inside the storefront; full http(s) URLs pass through.
 */
export function resolveAboutCtaHref(webstore: string, ctaHref: string): string {
  if (/^https?:\/\//.test(ctaHref)) return ctaHref;
  if (ctaHref.startsWith("/")) return `${webstore}${ctaHref}`;
  return `${webstore}/shop`;
}

export type StoreSettings = {
  storeName: string;
  tagline: string;
  description: string;
  logoPath: string | null;
  faviconPath: string | null;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  email: string | null;
  whatsapp: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  socials: SocialLinks;
  hours: WeekHours;
  /** Owner-editable About section; always resolved (defaults when unset). */
  about: AboutSettings;
  pickupInstructions: string | null;
  pickupLocation: string | null;
  pickupNotes: string | null;
  pickupEta: string | null;
  isOpen: boolean;
  acceptingOrders: boolean;
  statusMessage: string;
  /** Homepage hero slide cap, owner-configurable (Phase 5.1). */
  heroMaxSlides: number;
  currency: string;
  currencySymbol: string;
  timezone: string;
  updatedAt: string | null;
};

type SettingsRow = Record<string, unknown>;

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : null;
}

function asFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isWeekDay(value: string): value is WeekDay {
  return (WEEK_DAYS as readonly string[]).includes(value);
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function mapDayHours(value: unknown): DayHours {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const opensAt = typeof record.opens_at === "string" ? record.opens_at : "";
    const closesAt = typeof record.closes_at === "string" ? record.closes_at : "";
    if (TIME_PATTERN.test(opensAt) && TIME_PATTERN.test(closesAt) && opensAt < closesAt) {
      return { open: record.open === true, opens_at: opensAt, closes_at: closesAt };
    }
  }
  return { open: false, opens_at: "09:00", closes_at: "21:00" };
}

function mapHours(value: unknown): WeekHours {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(WEEK_DAYS.map((day) => [day, mapDayHours(record[day])])) as WeekHours;
}

function mapSocials(value: unknown): SocialLinks {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const socials: SocialLinks = {};
  for (const key of ["instagram", "facebook", "whatsapp"] as const) {
    if (typeof record[key] === "string" && record[key].trim()) socials[key] = record[key];
  }
  if (Array.isArray(record.extra)) {
    const extra = record.extra
      .filter(
        (entry): entry is { label: string; url: string } =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as { label?: unknown }).label === "string" &&
          typeof (entry as { url?: unknown }).url === "string" &&
          (entry as { label: string }).label.trim().length > 0 &&
          (entry as { url: string }).url.trim().length > 0,
      )
      .map((entry) => ({ label: entry.label, url: entry.url }));
    if (extra.length > 0) socials.extra = extra;
  }
  return socials;
}

/**
 * Maps a database row to the application model. Never throws: unknown or
 * malformed values fall back to safe defaults, so a bad row degrades to
 * neutral UI instead of a crash. Unknown enum-like values fail closed.
 */
export function mapSettingsRow(row: SettingsRow | null | undefined): StoreSettings | null {
  if (!row || typeof row !== "object") return null;

  const text = (key: string): string | null =>
    typeof row[key] === "string" && row[key].trim() ? (row[key] as string) : null;

  const storeName = text("store_name");
  if (!storeName) return null;

  const latitude = typeof row.latitude === "number" ? row.latitude : null;
  const longitude = typeof row.longitude === "number" ? row.longitude : null;

  return {
    storeName,
    tagline: text("tagline") ?? "",
    description: text("description") ?? "",
    logoPath: asText(row.logo_path),
    faviconPath: asText(row.favicon_path),
    phonePrimary: asText(row.phone_primary),
    phoneSecondary: asText(row.phone_secondary),
    email: asText(row.email),
    whatsapp: asText(row.whatsapp),
    addressLine1: asText(row.address_line1),
    addressLine2: asText(row.address_line2),
    locality: asText(row.locality),
    city: asText(row.city),
    state: asText(row.state),
    postalCode: asText(row.postal_code),
    country: text("country") ?? "India",
    mapsUrl: asText(row.maps_url),
    latitude: latitude !== null && latitude >= -90 && latitude <= 90 ? latitude : null,
    longitude: longitude !== null && longitude >= -180 && longitude <= 180 ? longitude : null,
    socials: mapSocials(row.socials),
    hours: mapHours(row.hours),
    about: resolveAbout(row.about),
    pickupInstructions: asText(row.pickup_instructions),
    pickupLocation: asText(row.pickup_location),
    pickupNotes: asText(row.pickup_notes),
    pickupEta: asText(row.pickup_eta),
    isOpen: asFlag(row.is_open, true),
    acceptingOrders: asFlag(row.accepting_orders, true),
    statusMessage: text("status_message") ?? "",
    heroMaxSlides:
      typeof row.hero_max_slides === "number" &&
      Number.isInteger(row.hero_max_slides) &&
      row.hero_max_slides >= 1 &&
      row.hero_max_slides <= 10
        ? row.hero_max_slides
        : 5,
    currency:
      typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) ? row.currency : "INR",
    currencySymbol: text("currency_symbol") ?? "₹",
    timezone: text("timezone") ?? "Asia/Kolkata",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/** Weekday key for `new Date().getDay()` (0 = Sunday). */
export function dayKeyFor(date: Date): WeekDay {
  return WEEK_DAYS[(date.getDay() + 6) % 7];
}

/** True when every day is closed or hours are missing. */
export function hasAnyHours(hours: WeekHours): boolean {
  return WEEK_DAYS.some((day) => hours[day]?.open === true);
}

export { isWeekDay };
