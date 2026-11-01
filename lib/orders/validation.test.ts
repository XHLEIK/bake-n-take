import { describe, expect, it } from "vitest";

import { cartItemSchema, contactSchema, IDEMPOTENCY_PATTERN, paymentSchema } from "./validation";

describe("cartItemSchema", () => {
  it("accepts a complete configuration reference", () => {
    const result = cartItemSchema.safeParse({
      productId: "11111111-1111-4111-8111-111111111111",
      variantId: "22222222-2222-4222-8222-222222222222",
      flavourId: "",
      eggEggless: "eggless",
      message: "Happy birthday!",
      designPath: "",
      quantity: 2,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.flavourId).toBeNull();
    expect(result.data.designPath).toBe("");
  });

  it("rejects bad ids and quantities", () => {
    expect(
      cartItemSchema.safeParse({
        productId: "nope",
        quantity: 1,
      }).success,
    ).toBe(false);
    const base = {
      productId: "11111111-1111-4111-8111-111111111111",
      quantity: 1,
    };
    expect(cartItemSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ ...base, quantity: 100 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ ...base, quantity: 1.5 }).success).toBe(false);
  });

  it("caps message length", () => {
    expect(
      cartItemSchema.safeParse({
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: 1,
        message: "x".repeat(61),
      }).success,
    ).toBe(false);
  });

  it("accepts pickup instants and rejects malformed ones", () => {
    const base = {
      productId: "11111111-1111-4111-8111-111111111111",
      variantId: "",
      flavourId: "",
      eggEggless: "",
      message: "",
      designPath: "",
      quantity: 1,
    };
    const good = cartItemSchema.safeParse({ ...base, pickupAt: "2026-09-26T17:00:00.000Z" });
    expect(good.success).toBe(true);
    if (good.success) expect(good.data.pickupAt).toBe("2026-09-26T17:00:00.000Z");
    expect(cartItemSchema.safeParse({ ...base, pickupAt: "tomorrow-ish" }).success).toBe(false);
  });
});

describe("contactSchema", () => {
  it("accepts valid contact details", () => {
    expect(
      contactSchema.safeParse({
        fullName: "Aarav Sharma",
        phone: "+91 98765 43210",
        email: "a@b.co",
      }).success,
    ).toBe(true);
  });

  it("rejects obvious junk without leaking reasons", () => {
    expect(contactSchema.safeParse({ fullName: "A", phone: "12", email: "nope" }).success).toBe(
      false,
    );
  });
});

describe("paymentSchema", () => {
  it("accepts only the Phase 4 methods", () => {
    expect(paymentSchema.safeParse({ method: "cod" }).success).toBe(true);
    expect(paymentSchema.safeParse({ method: "pay_at_pickup" }).success).toBe(true);
    expect(paymentSchema.safeParse({ method: "upi" }).success).toBe(false);
    expect(paymentSchema.safeParse({ method: "" }).success).toBe(false);
  });
});

describe("IDEMPOTENCY_PATTERN", () => {
  it("accepts UUID-shaped keys and rejects junk", () => {
    expect(IDEMPOTENCY_PATTERN.test("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(IDEMPOTENCY_PATTERN.test("")).toBe(false);
    expect(IDEMPOTENCY_PATTERN.test("a b")).toBe(false);
  });
});
