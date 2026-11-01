import { z } from "zod";

import { BANNER_STYLES, DEST_TYPES, PROMOTION_TYPES } from "./types";

/**
 * Boundary validation for owner promotion forms (Phase 5).
 *
 * The form speaks rupees and datetime-local strings; this layer validates
 * and normalizes them. Paise conversion and UTC storage happen in the
 * actions. Coupon codes are normalized to unambiguous uppercase here, and
 * the database re-checks the format with its own constraint.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COUPON_CODE_PATTERN = /^[A-Z0-9]{4,24}$/;

/** Owner-picked gallery/banner paths: flat predefined files or per-owner folders. */
export const GALLERY_PATH_PATTERN =
  /^banners\/(?:[A-Za-z0-9_-]+\/)?[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i;

/** Canonical coupon form: trimmed, uppercased, unambiguous charset. */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCouponCode(raw: string): boolean {
  return COUPON_CODE_PATTERN.test(normalizeCouponCode(raw));
}

/** Paise for a rupees input. Rejects fractional paise (e.g. ₹1.005). */
export function rupeesToPaise(rupees: number): number | null {
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise)) return null;
  if (Math.abs(paise - rupees * 100) > 1e-6) return null;
  return paise;
}

/**
 * Parses a datetime-local value ("YYYY-MM-DDTHH:mm") as Asia/Kolkata wall
 * time (fixed +05:30, no DST) into an ISO UTC string. Returns null for "".
 */
export function istLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}:00+05:30`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Formats a stored UTC instant for datetime-local inputs (IST wall time). */
export function isoToIstLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function optionalRupees(message: string) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value.length === 0) return null;
      const rupees = Number(value);
      if (!Number.isFinite(rupees) || rupees < 0) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      const paise = rupeesToPaise(rupees);
      if (paise === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return paise;
    });
}

function optionalCount(message: string) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value.length === 0) return null;
      if (!/^[0-9]+$/.test(value)) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      const count = Number(value);
      if (!Number.isSafeInteger(count) || count < 1) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return count;
    });
}

const uuidList = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) return [] as string[];
    const ids = value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const unique = [...new Set(ids)];
    if (unique.length > 200 || !unique.every((id) => UUID_PATTERN.test(id))) {
      ctx.addIssue({ code: "custom", message: "Invalid target selection." });
      return z.NEVER;
    }
    return unique;
  });

export const promotionFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the offer a name.").max(120, "Keep the name short."),
    type: z.enum(PROMOTION_TYPES, { message: "Pick an offer type." }),
    priority: z
      .enum(["high", "normal", "low"], { message: "Pick a priority." })
      .transform((value) => (value === "high" ? 300 : value === "low" ? 10 : 100)),
    isExclusive: z.string().transform((value) => value === "on"),
    isStackable: z.string().transform((value) => value === "on"),
    autoApply: z.string().transform((value) => value === "on"),
    repeatable: z.string().transform((value) => value === "on"),
    startsAt: z.string().trim(),
    endsAt: z.string().trim(),
    minOrderRupees: optionalRupees("Minimum order must be ₹0 or more."),
    maxDiscountRupees: optionalRupees("Maximum discount must be ₹0 or more."),
    maxUsesGlobal: optionalCount("Usage limit must be at least 1."),
    maxUsesPerCustomer: optionalCount("Per-customer limit must be at least 1."),
    // Per-type configuration.
    percent: z.string().trim().default(""),
    buyQty: z.string().trim().default(""),
    rewardQty: z.string().trim().default(""),
    rewardKind: z.enum(["free", "percent", "price"]).default("free"),
    rewardPercent: z.string().trim().default(""),
    rewardPriceRupees: z.string().trim().default(""),
    bundleQty: z.string().trim().default(""),
    bundlePriceRupees: z.string().trim().default(""),
    foKind: z.enum(["fixed", "percent"]).default("fixed"),
    foValue: z.string().trim().default(""),
    // Targeting (comma-separated UUIDs from checkbox groups).
    categoryIds: uuidList,
    productIds: uuidList,
    triggerCategoryIds: uuidList,
    triggerProductIds: uuidList,
    rewardCategoryIds: uuidList,
    rewardProductIds: uuidList,
    // Coupons (one per line in the textarea).
    couponsText: z.string().max(2000, "Too many coupon codes."),
    // Banner + destination.
    // Note: the banner header is always the offer name (set in actions).
    bannerTitle: z.string().trim().max(120, "Keep the title short.").default(""),
    bannerDescription: z.string().trim().max(500, "Keep the description short.").default(""),
    bannerCtaLabel: z.string().trim().max(40, "Keep the button label short.").default(""),
    bannerStyle: z.enum(BANNER_STYLES).default("ember"),
    removeBannerImage: z.string().transform((value) => value === "on"),
    galleryImagePath: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || GALLERY_PATH_PATTERN.test(value), {
        message: "Invalid gallery image.",
      }),
    destType: z.enum(DEST_TYPES).default("store"),
    destCategoryId: z.string().trim().default(""),
    destProductId: z.string().trim().default(""),
  })
  .superRefine((data, ctx) => {
    // Validity window.
    const starts = istLocalToIso(data.startsAt);
    const ends = istLocalToIso(data.endsAt);
    if (data.startsAt.trim().length > 0 && starts === null) {
      ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Invalid start date." });
    }
    if (data.endsAt.trim().length > 0 && ends === null) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Invalid end date." });
    }
    if (starts && ends && ends <= starts) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start." });
    }
    // Type-specific configuration.
    if (data.type === "percentage") {
      if (
        !/^[0-9]+$/.test(data.percent) ||
        Number(data.percent) < 1 ||
        Number(data.percent) > 100
      ) {
        ctx.addIssue({ code: "custom", path: ["percent"], message: "Percent must be 1–100." });
      }
    }
    if (data.type === "buy_x_get_y") {
      if (!/^[0-9]+$/.test(data.buyQty) || Number(data.buyQty) < 1) {
        ctx.addIssue({ code: "custom", path: ["buyQty"], message: "Buy quantity must be ≥ 1." });
      }
      if (!/^[0-9]+$/.test(data.rewardQty) || Number(data.rewardQty) < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["rewardQty"],
          message: "Reward quantity must be ≥ 1.",
        });
      }
      if (data.rewardKind === "percent" && (+data.rewardPercent < 1 || +data.rewardPercent > 100)) {
        ctx.addIssue({
          code: "custom",
          path: ["rewardPercent"],
          message: "Reward percent must be 1–100.",
        });
      }
      if (data.rewardKind === "price" && rupeesToPaise(Number(data.rewardPriceRupees)) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["rewardPriceRupees"],
          message: "Reward price must be ₹0 or more.",
        });
      }
    }
    if (data.type === "mix_match") {
      if (!/^[0-9]+$/.test(data.bundleQty) || Number(data.bundleQty) < 2) {
        ctx.addIssue({ code: "custom", path: ["bundleQty"], message: "Bundle size must be ≥ 2." });
      }
      if (rupeesToPaise(Number(data.bundlePriceRupees)) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["bundlePriceRupees"],
          message: "Bundle price must be ₹0 or more.",
        });
      }
    }
    if (data.type === "first_order") {
      if (data.foKind === "percent" && (+data.foValue < 1 || +data.foValue > 100)) {
        ctx.addIssue({ code: "custom", path: ["foValue"], message: "Percent must be 1–100." });
      }
      if (data.foKind === "fixed" && rupeesToPaise(Number(data.foValue)) === null) {
        ctx.addIssue({ code: "custom", path: ["foValue"], message: "Amount must be ₹1 or more." });
      }
      if (data.foKind === "fixed" && Number(data.foValue) < 1) {
        ctx.addIssue({ code: "custom", path: ["foValue"], message: "Amount must be ₹1 or more." });
      }
    }
    // Coupon-gated promotions never auto-apply (explicit by design).
    const codes = parseCouponLines(data.couponsText);
    if (codes.invalid.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["couponsText"],
        message: `Invalid codes (4–24 letters/digits): ${codes.invalid.slice(0, 3).join(", ")}`,
      });
    }
    if (codes.valid.length > 0 && data.autoApply) {
      ctx.addIssue({
        code: "custom",
        path: ["autoApply"],
        message: "Coupon offers apply by code only — turn off automatic application.",
      });
    }
    if (codes.valid.length === 0 && !data.autoApply) {
      ctx.addIssue({
        code: "custom",
        path: ["couponsText"],
        message: "Code-only offers need at least one coupon code.",
      });
    }
    // Destination references.
    if (data.destType === "category" && !UUID_PATTERN.test(data.destCategoryId)) {
      ctx.addIssue({ code: "custom", path: ["destCategoryId"], message: "Pick a category." });
    }
    if (data.destType === "product" && !UUID_PATTERN.test(data.destProductId)) {
      ctx.addIssue({ code: "custom", path: ["destProductId"], message: "Pick a product." });
    }
  });

export type PromotionFormInput = z.output<typeof promotionFormSchema>;

/** Splits a coupon textarea into normalized valid codes + rejected lines. */
export function parseCouponLines(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const code = normalizeCouponCode(line);
    if (code.length === 0) continue;
    if (isValidCouponCode(code)) {
      if (!valid.includes(code)) valid.push(code);
    } else {
      invalid.push(line.trim());
    }
  }
  return { valid, invalid };
}

export const PROMOTION_FORM_FIELDS = [
  "name",
  "type",
  "priority",
  "isExclusive",
  "isStackable",
  "autoApply",
  "repeatable",
  "startsAt",
  "endsAt",
  "minOrderRupees",
  "maxDiscountRupees",
  "maxUsesGlobal",
  "maxUsesPerCustomer",
  "percent",
  "buyQty",
  "rewardQty",
  "rewardKind",
  "rewardPercent",
  "rewardPriceRupees",
  "bundleQty",
  "bundlePriceRupees",
  "foKind",
  "foValue",
  "categoryIds",
  "productIds",
  "triggerCategoryIds",
  "triggerProductIds",
  "rewardCategoryIds",
  "rewardProductIds",
  "couponsText",
  "bannerTitle",
  "bannerDescription",
  "bannerCtaLabel",
  "bannerStyle",
  "removeBannerImage",
  "galleryImagePath",
  "destType",
  "destCategoryId",
  "destProductId",
] as const;
