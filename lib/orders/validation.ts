import { z } from "zod";

import { emailSchema, fullNameSchema, phoneSchema } from "@/lib/validation/auth";

/**
 * Boundary validation for cart and checkout inputs (Phase 4).
 *
 * The client only ever names things: product/variant/flavour ids, options,
 * quantities, contact details. Prices, totals, statuses and roles never cross
 * the boundary — the server re-derives them from catalog rows.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalUuid() {
  return z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .refine((value) => value === null || UUID_PATTERN.test(value), {
      message: "That selection is no longer available.",
    });
}

export const cartItemSchema = z.object({
  productId: z.string().trim().regex(UUID_PATTERN, "Pick a product."),
  variantId: optionalUuid(),
  flavourId: optionalUuid(),
  eggEggless: z.enum(["egg", "eggless", ""]).default(""),
  message: z.string().trim().max(60, "Keep the message under 60 characters.").default(""),
  designPath: z.string().trim().max(500, "Bad design reference.").default(""),
  pickupAt: z
    .string()
    .trim()
    .max(100, "Bad pickup time.")
    .default("")
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
      message: "Pick a pickup date and time.",
    }),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity is at least 1.")
    .max(99, "At most 99 per line."),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

export const contactSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: emailSchema,
});

export type ContactInput = z.infer<typeof contactSchema>;

export const PAYMENT_METHODS = ["cod", "pay_at_pickup"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS, { message: "Choose how to pay." }),
});

export const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{8,80}$/;
