import { z } from "zod";

import type { VariantMode } from "./types";

/**
 * Boundary validation for the catalog (Phase 3).
 *
 * Money crosses the boundary as decimal rupees ("600", "1100.50") and is
 * converted to integer paise here — the only place that conversion happens.
 * The database stores paise; the client never decides a price, it only sends
 * labels the server re-prices from its own rows.
 */

const MAX_PAISE = 100_000_000;

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

function flagField() {
  return z.enum(["1", "0"]).transform((value) => value === "1");
}

/** Opt-in flags added later: missing/blank means the default (old payloads keep working). */
function optionalFlag(defaultValue: boolean) {
  return z
    .prefault(z.enum(["1", "0", ""]), defaultValue ? "1" : "0")
    .transform((value) => value === "1");
}

function orderField() {
  return z.prefault(
    z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? 0 : value))
      .refine(
        (value) => {
          if (value === 0) return true;
          return /^\d+$/.test(value) && Number(value) <= 1_000_000;
        },
        { message: "Use an order number from 0 to 1000000." },
      )
      .transform((value) => (typeof value === "number" ? value : Number(value))),
    "",
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rowId() {
  // New rows arrive as JSON null from the form; saved rows carry a UUID.
  return z
    .string()
    .trim()
    .max(40, "Bad row id.")
    .transform((value) => (value.length === 0 ? null : value))
    .refine((value) => value === null || UUID_PATTERN.test(value), { message: "Bad row id." })
    .nullable();
}

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name.")
    .max(80, "Keep it under 80 characters."),
});

export type CategoryInput = z.infer<typeof categorySchema>;

const variantRowSchema = z.object({
  id: rowId(),
  label: z.string().trim().min(1, "Label each option.").max(60, "Keep labels under 60 characters."),
  value: z
    .string()
    .trim()
    .max(60, "Keep values under 60 characters.")
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  priceRupees: z
    .string()
    .trim()
    .refine(
      (value) => {
        if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
        const paise = Math.round(Number(value) * 100);
        return Number.isSafeInteger(paise) && paise >= 100 && paise <= MAX_PAISE;
      },
      { message: "Each option needs a price of at least ₹1." },
    )
    .transform((value) => Math.round(Number(value) * 100)),
  isActive: z.boolean(),
});

const flavourRowSchema = z.object({
  id: rowId(),
  name: z.string().trim().min(1, "Name each flavour.").max(60, "Keep names under 60 characters."),
  surchargeRupees: z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value.length === 0) return true;
        if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
        const paise = Math.round(Number(value) * 100);
        return Number.isSafeInteger(paise) && paise <= MAX_PAISE;
      },
      { message: "Surcharges must be ₹0 or more." },
    )
    .transform((value) => (value.length === 0 ? 0 : Math.round(Number(value) * 100))),
  isActive: z.boolean(),
});

function rowsJson<Row>(schema: z.ZodType<Row>, noun: string, uniqueKey: (row: Row) => string) {
  return z.string().transform((value, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: "custom", message: `Those ${noun} are malformed.` });
      return z.NEVER;
    }
    if (!Array.isArray(parsed) || parsed.length > 40) {
      ctx.addIssue({ code: "custom", message: `Keep it to 40 ${noun} or fewer.` });
      return z.NEVER;
    }
    const result = z.array(schema).safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: `Check the ${noun} below.` });
      return z.NEVER;
    }
    const seen = new Set<string>();
    for (const row of result.data) {
      const key = uniqueKey(row).toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: `Duplicate ${noun} are not allowed.` });
        return z.NEVER;
      }
      seen.add(key);
    }
    return result.data;
  });
}

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the product a name.")
    .max(120, "Keep it under 120 characters."),
  shortDescription: z.string().trim().max(200, "Keep the short description under 200 characters."),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters."),
  basePriceRupees: z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value.length === 0) return true;
        if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
        const paise = Math.round(Number(value) * 100);
        return Number.isSafeInteger(paise) && paise <= MAX_PAISE;
      },
      { message: "Use a price of ₹0 or more." },
    )
    .transform((value) => (value.length === 0 ? 0 : Math.round(Number(value) * 100))),
  categoryId: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .refine((value) => value === null || UUID_PATTERN.test(value), {
      message: "Pick a category.",
    }),
  variantMode: z.enum(["none", "size", "quantity"]) as z.ZodType<VariantMode>,
  variantsJson: rowsJson(variantRowSchema, "options", (row) => row.label),
  flavoursJson: rowsJson(flavourRowSchema, "flavours", (row) => row.name),
  isActive: flagField(),
  isFeatured: flagField(),
  isTrending: flagField(),
  allowCustomDesign: flagField(),
  eggEgglessEnabled: flagField(),
  egglessSurchargeRupees: z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value.length === 0) return true;
        if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
        const paise = Math.round(Number(value) * 100);
        return Number.isSafeInteger(paise) && paise <= MAX_PAISE;
      },
      { message: "Use a surcharge of ₹0 or more." },
    )
    .transform((value) => (value.length === 0 ? 0 : Math.round(Number(value) * 100))),
  messageEnabled: flagField(),
  displayOrder: orderField(),
  prepHours: z.prefault(
    z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? "12" : value))
      .refine(
        (value) =>
          /^\d+(\.\d{1,2})?$/.test(value) &&
          Number(value) <= 720 &&
          Number.isSafeInteger(Math.round(Number(value) * 60)),
        {
          message: "Use 0 to 720 hours (e.g. 0.5 for 30 minutes).",
        },
      )
      .transform((value) => Math.round(Number(value) * 60)),
    "",
  ),
  // Store visibility & promotion (Phase 5.1 merchandising).
  isNew: optionalFlag(false),
  newUntil: z.prefault(
    z
      .string()
      .trim()
      .max(10, "Use a calendar date.")
      .refine((value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: "Use a calendar date.",
      }),
    "",
  ),
  heroFeatured: optionalFlag(false),
  heroEnabled: optionalFlag(true),
  heroTitle: z.prefault(z.string().trim().max(120, "Keep the hero title short."), ""),
  heroDescription: z.prefault(z.string().trim().max(500, "Keep the hero text short."), ""),
  heroCta: z.prefault(z.string().trim().max(40, "Keep the button label short."), ""),
  heroPriority: orderField(),
  heroStartsAt: z.prefault(z.string().trim().max(16, "Invalid start date."), ""),
  heroEndsAt: z.prefault(z.string().trim().max(16, "Invalid end date."), ""),
  heroGalleryPath: z.prefault(z.string().trim().max(500, "Bad gallery reference."), ""),
});

export type ProductInput = z.infer<typeof productSchema>;

export { optionalText };
