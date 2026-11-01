import { z } from "zod";

import { GALLERY_PATH_PATTERN, istLocalToIso } from "@/lib/promotions/validation";

import { HERO_TYPES } from "./types";

/**
 * Boundary validation for owner hero forms (Phase 5.1).
 *
 * Source references are validated for shape here and existence in the
 * actions (curated errors); availability (active dates, live catalog rows)
 * is always re-checked at selection time, never trusted from saved state.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalId(message: string) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value.length === 0) return null;
      if (!UUID_PATTERN.test(value)) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return value;
    });
}

export const heroFormSchema = z
  .object({
    type: z.enum(HERO_TYPES, { message: "Pick a content type." }),
    displayOrder: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!/^[0-9]+$/.test(value)) {
          ctx.addIssue({ code: "custom", message: "Order must be 0–10000." });
          return z.NEVER;
        }
        const order = Number(value);
        if (!Number.isSafeInteger(order) || order < 0 || order > 10000) {
          ctx.addIssue({ code: "custom", message: "Order must be 0–10000." });
          return z.NEVER;
        }
        return order;
      }),
    priority: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!/^[0-9]+$/.test(value)) {
          ctx.addIssue({ code: "custom", message: "Priority must be 0–1000." });
          return z.NEVER;
        }
        const priority = Number(value);
        if (!Number.isSafeInteger(priority) || priority < 0 || priority > 1000) {
          ctx.addIssue({ code: "custom", message: "Priority must be 0–1000." });
          return z.NEVER;
        }
        return priority;
      }),
    startsAt: z.string().trim(),
    endsAt: z.string().trim(),
    title: z.string().trim().max(120, "Keep the headline short.").default(""),
    description: z.string().trim().max(500, "Keep the description short.").default(""),
    ctaLabel: z.string().trim().max(40, "Keep the button label short.").default(""),
    removeImage: z.string().transform((value) => value === "on"),
    galleryImagePath: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || GALLERY_PATH_PATTERN.test(value), {
        message: "Invalid gallery image.",
      }),
    destType: z.enum(["store", "category", "product"]).default("store"),
    destCategoryId: z.string().trim().default(""),
    destProductId: z.string().trim().default(""),
    promotionId: optionalId("Pick a valid offer."),
    productId: optionalId("Pick a valid product."),
    categoryId: optionalId("Pick a valid category."),
  })
  .superRefine((data, ctx) => {
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
    // Source references per type.
    if (data.type === "offer" && !data.promotionId) {
      ctx.addIssue({ code: "custom", path: ["promotionId"], message: "Pick an offer to feature." });
    }
    if (data.type === "product" && !data.productId) {
      ctx.addIssue({ code: "custom", path: ["productId"], message: "Pick a product to feature." });
    }
    if (data.type === "category" && !data.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pick a category." });
    }
    // Free-content types need their own headline.
    if (
      (data.type === "announcement" || data.type === "campaign") &&
      data.title.trim().length === 0
    ) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "Give the slide a headline." });
    }
    if (data.type === "system") {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "System slides are managed, not created.",
      });
    }
    // Destinations for free-content types.
    if (data.destType === "category" && !UUID_PATTERN.test(data.destCategoryId)) {
      ctx.addIssue({ code: "custom", path: ["destCategoryId"], message: "Pick a category." });
    }
    if (data.destType === "product" && !UUID_PATTERN.test(data.destProductId)) {
      ctx.addIssue({ code: "custom", path: ["destProductId"], message: "Pick a product." });
    }
  });

export type HeroFormInput = z.output<typeof heroFormSchema>;

export const HERO_FORM_FIELDS = [
  "type",
  "displayOrder",
  "priority",
  "startsAt",
  "endsAt",
  "title",
  "description",
  "ctaLabel",
  "removeImage",
  "galleryImagePath",
  "destType",
  "destCategoryId",
  "destProductId",
  "promotionId",
  "productId",
  "categoryId",
] as const;
