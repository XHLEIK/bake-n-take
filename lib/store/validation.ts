import { z } from "zod";

import { phoneSchema } from "@/lib/validation/auth";

import { WEEK_DAYS, isAboutBannerKey, type AboutBannerKey } from "./types";

/**
 * Boundary validation for store settings (Phase 2).
 *
 * Runs on the server in `lib/store/actions.ts` — that run is the control —
 * and on the client in the settings form for immediate feedback. Empty form
 * fields arrive as "" and are normalised to null for nullable columns.
 */

/** Optional text: missing or "" becomes null, otherwise length-checked. */
function optionalText(max: number, message: string) {
  return z.prefault(
    z
      .string()
      .trim()
      .max(max, message)
      .transform((value) => (value.length === 0 ? null : value)),
    "",
  );
}

function optionalEmail() {
  return z.prefault(
    z
      .string()
      .trim()
      .max(254, "That email address is too long.")
      .transform((value) => (value.length === 0 ? null : value))
      .refine(
        (value) => value === null || z.email().safeParse(value).success,
        "Enter a valid email address.",
      ),
    "",
  );
}

function optionalPhone(message = "Enter a valid phone number.") {
  return z.prefault(
    z
      .string()
      .trim()
      .max(20, "That phone number is too long.")
      .transform((value) => (value.length === 0 ? null : value))
      .refine(
        (value) =>
          value === null ||
          (phoneSchema.safeParse(value).success && value.replace(/\D/g, "").length >= 7),
        message,
      ),
    "",
  );
}

/** http(s) URLs only — never javascript:, data:, or protocol-relative. */
function optionalUrl(max: number, message: string) {
  return z.prefault(
    z
      .string()
      .trim()
      .max(max, message)
      .transform((value) => (value.length === 0 ? null : value))
      .refine((value) => {
        if (value === null) return true;
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }, message),
    "",
  );
}

function optionalCoordinate(min: number, max: number, message: string) {
  return z.prefault(
    z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? null : value))
      .refine((value) => {
        if (value === null) return true;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= min && parsed <= max;
      }, message)
      .transform((value) => (value === null ? null : Number(value))),
    "",
  );
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayHoursSchema = z
  .object({
    open: z.boolean(),
    opens_at: z.string().regex(TIME_PATTERN, "Use 24-hour HH:MM, e.g. 09:00."),
    closes_at: z.string().regex(TIME_PATTERN, "Use 24-hour HH:MM, e.g. 21:00."),
  })
  .refine((day) => !day.open || day.opens_at < day.closes_at, {
    message: "Closing time must be after opening time.",
    path: ["closes_at"],
  });

const hoursSchema = z.object(
  Object.fromEntries(WEEK_DAYS.map((day) => [day, dayHoursSchema])) as Record<
    (typeof WEEK_DAYS)[number],
    typeof dayHoursSchema
  >,
);

const socialExtraSchema = z.object({
  label: z.string().trim().min(1, "Name this link.").max(30, "Keep the name under 30 characters."),
  url: z
    .string()
    .trim()
    .max(300, "That URL is too long.")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a full http(s) URL, e.g. https://…"),
});

const socialsSchema = z.object({
  instagram: optionalUrl(300, "Enter a full http(s) URL, e.g. https://instagram.com/…"),
  facebook: optionalUrl(300, "Enter a full http(s) URL, e.g. https://facebook.com/…"),
  whatsapp: optionalUrl(300, "Enter a full http(s) URL, e.g. https://wa.me/…"),
  extra: z.array(socialExtraSchema).max(6, "At most 6 extra links.").default([]),
});

/**
 * IANA timezone shape check (Area/Location, e.g. Asia/Kolkata, plus UTC).
 *
 * Deliberately format-level rather than list-level: runtime tz databases
 * differ (some builds omit modern aliases such as Asia/Kolkata), so checking
 * against `Intl.supportedValuesOf("timeZone")` would reject valid zones on
 * some servers. A well-formed but unknown zone only fails if date math ever
 * uses it — and nothing in Phase 2 does.
 */
const TIMEZONE_PATTERN = /^[A-Za-z_+-]+\/[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)?$/;

/**
 * Owner-editable About Us content (Phase 7).
 *
 * Submitted as one JSON document; the custom banner file travels as a
 * separate upload and its storage path is merged server-side. An emptied
 * secondary line stays empty (it simply doesn't render); essentials fall
 * back to compiled defaults rather than saving a broken section.
 */
const aboutSchema = z.object({
  enabled: z.boolean(),
  eyebrow: z.string().trim().min(1, "Give the section an eyebrow.").max(60),
  heading: z.string().trim().min(1, "Give the section a heading.").max(120),
  body: z.string().trim().min(1, "Write the About body copy.").max(2000),
  secondary: z.string().trim().max(500),
  cta_label: z.string().trim().min(1, "Label the section button.").max(40),
  cta_href: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value.length === 0 || /^(\/|https?:\/\/)/.test(value),
      "Use an in-store path (/shop) or a full http(s) URL.",
    )
    .transform((value) => (value.length === 0 ? "/shop" : value)),
  banner: z
    .string()
    .refine((value): value is AboutBannerKey => isAboutBannerKey(value), "Pick a banner.")
    .default("bread"),
});

export const storeSettingsSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1, "Give the store a name.")
    .max(80, "Keep the store name under 80 characters."),
  tagline: z.string().trim().max(160, "Keep the tagline under 160 characters."),
  description: z.string().trim().max(1000, "Keep the description under 1000 characters."),
  phonePrimary: optionalPhone(),
  phoneSecondary: optionalPhone(),
  email: optionalEmail(),
  whatsapp: optionalPhone("Enter a valid WhatsApp number."),
  addressLine1: optionalText(120, "Keep address line 1 under 120 characters."),
  addressLine2: optionalText(120, "Keep address line 2 under 120 characters."),
  locality: optionalText(80, "Keep the locality under 80 characters."),
  city: optionalText(80, "Keep the city under 80 characters."),
  state: optionalText(80, "Keep the state under 80 characters."),
  postalCode: z
    .string()
    .trim()
    .max(12, "Keep the PIN code under 12 characters.")
    .refine((value) => value.length === 0 || /^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(value), {
      message: "Use letters, digits, spaces or hyphens.",
    })
    .transform((value) => (value.length === 0 ? null : value)),
  country: z
    .string()
    .trim()
    .min(1, "Name the country.")
    .max(60, "Keep the country under 60 characters."),
  mapsUrl: optionalUrl(500, "Enter a full http(s) maps link."),
  latitude: optionalCoordinate(-90, 90, "Latitude must be between -90 and 90."),
  longitude: optionalCoordinate(-180, 180, "Longitude must be between -180 and 180."),
  socialsJson: z.string().transform((value, ctx) => {
    try {
      const result = socialsSchema.safeParse(JSON.parse(value) as unknown);
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: "Check the social links below." });
        return z.NEVER;
      }
      return result.data;
    } catch {
      ctx.addIssue({ code: "custom", message: "Social links are malformed." });
      return z.NEVER;
    }
  }),
  hoursJson: z.string().transform((value, ctx) => {
    try {
      const result = hoursSchema.safeParse(JSON.parse(value) as unknown);
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: "Check the business hours below." });
        return z.NEVER;
      }
      return result.data;
    } catch {
      ctx.addIssue({ code: "custom", message: "Business hours are malformed." });
      return z.NEVER;
    }
  }),
  aboutJson: z
    .string()
    .default("")
    .transform((value, ctx) => {
      if (value.trim().length === 0) return { keep: true as const };
      try {
        const result = aboutSchema.safeParse(JSON.parse(value) as unknown);
        if (!result.success) {
          ctx.addIssue({ code: "custom", message: "Check the About Us section below." });
          return z.NEVER;
        }
        return { keep: false as const, data: result.data };
      } catch {
        ctx.addIssue({ code: "custom", message: "About Us settings are malformed." });
        return z.NEVER;
      }
    }),
  pickupInstructions: optionalText(500, "Keep pickup instructions under 500 characters."),
  pickupLocation: optionalText(200, "Keep the pickup location under 200 characters."),
  pickupNotes: optionalText(500, "Keep pickup notes under 500 characters."),
  pickupEta: optionalText(120, "Keep the preparation note under 120 characters."),
  isOpen: z.enum(["1", "0"]).transform((value) => value === "1"),
  acceptingOrders: z.enum(["1", "0"]).transform((value) => value === "1"),
  statusMessage: z.string().trim().max(200, "Keep the status message under 200 characters."),
  heroMaxSlides: z.prefault(
    z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (value.length === 0) return 5;
        if (!/^[0-9]+$/.test(value)) {
          ctx.addIssue({ code: "custom", message: "Slides must be 1–10." });
          return z.NEVER;
        }
        const slides = Number(value);
        if (!Number.isSafeInteger(slides) || slides < 1 || slides > 10) {
          ctx.addIssue({ code: "custom", message: "Slides must be 1–10." });
          return z.NEVER;
        }
        return slides;
      }),
    "5",
  ),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter code, e.g. INR."),
  currencySymbol: z
    .string()
    .trim()
    .min(1, "Give the currency symbol.")
    .max(4, "Keep the symbol under 4 characters."),
  timezone: z
    .string()
    .trim()
    .min(1, "Name the timezone.")
    .max(60, "That timezone looks wrong.")
    .refine((value) => value === "UTC" || TIMEZONE_PATTERN.test(value), {
      message: "Use an IANA timezone, e.g. Asia/Kolkata.",
    }),
  logoRemoved: z.enum(["1", "0"]).default("0"),
  // Deprecated: the separate favicon upload was removed (the store logo is
  // the favicon now), so the settings form no longer submits this field and
  // `formDataToObject` delivers "" for it. Treat "" as "keep" — an explicit
  // "1" from any older client still removes. Output stays "0" | "1".
  faviconRemoved: z
    .enum(["1", "0", ""])
    .transform((value) => (value === "" ? "0" : value))
    .default("0"),
  aboutBannerRemoved: z.enum(["1", "0"]).default("0"),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

/** Logo/favicon constraints shared by client preview and server validation. */
export const LOGO_CONSTRAINTS = {
  maxBytes: 2 * 1024 * 1024,
  extensions: ["png", "jpg", "jpeg", "webp"],
  maxDimension: 4096,
} as const;

/** Magic-byte signatures: never trust the extension alone. */
const IMAGE_SIGNATURES = [
  { kind: "png", header: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: "jpeg", header: [0xff, 0xd8, 0xff] },
  { kind: "webp", header: [0x52, 0x49, 0x46, 0x46] },
] as const;

export type LogoValidation =
  { ok: true; kind: "png" | "jpeg" | "webp" } | { ok: false; error: string };

/**
 * Validates an uploaded image from its bytes: type by magic number, size cap,
 * and a dimension ceiling for PNG/JPEG (parsed from the headers, no decoder
 * needed). SVG is deliberately rejected — inline SVG can carry scripts.
 */
export async function validateImageUpload(
  file: File,
  maxBytes: number = LOGO_CONSTRAINTS.maxBytes,
): Promise<LogoValidation> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    return { ok: false, error: `Keep the image under ${mb} MB.` };
  }

  const full = await file.arrayBuffer();
  const bytes = new Uint8Array(full.slice(0, 32));
  const signature = IMAGE_SIGNATURES.find(({ header }) =>
    header.every((byte, index) => bytes[index] === byte),
  );
  if (!signature) {
    return { ok: false, error: "Use a PNG, JPEG or WebP image." };
  }

  if (signature.kind === "png" && bytes.length >= 24) {
    const width = new DataView(bytes.buffer).getUint32(16);
    const height = new DataView(bytes.buffer).getUint32(20);
    if (width > LOGO_CONSTRAINTS.maxDimension || height > LOGO_CONSTRAINTS.maxDimension) {
      return { ok: false, error: "Keep each side under 4096 pixels." };
    }
  }

  if (signature.kind === "jpeg") {
    const dimensions = jpegDimensions(await file.arrayBuffer());
    if (dimensions) {
      const [width, height] = dimensions;
      if (width > LOGO_CONSTRAINTS.maxDimension || height > LOGO_CONSTRAINTS.maxDimension) {
        return { ok: false, error: "Keep each side under 4096 pixels." };
      }
    }
  }

  return { ok: true, kind: signature.kind };
}

/** Scans JPEG markers for the first Start-Of-Frame segment. Null when unreadable. */
function jpegDimensions(buffer: ArrayBuffer): [number, number] | null {
  const bytes = new Uint8Array(buffer);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    // SOF0–SOF3 (baseline/progressive); skip DHT/DAC/DNL and restarts.
    if (marker >= 0xc0 && marker <= 0xc3) {
      const view = new DataView(buffer, offset + 5, 4);
      return [view.getUint16(2), view.getUint16(0)];
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = new DataView(buffer, offset + 2, 2).getUint16(0);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}
