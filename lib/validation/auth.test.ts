import { describe, expect, it } from "vitest";

import {
  emailSchema,
  fieldErrorsFrom,
  forgotPasswordSchema,
  parseForm,
  passwordSchema,
  phoneSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "./auth";

function formDataOf(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("emailSchema", () => {
  it("accepts normal addresses and trims them", () => {
    expect(emailSchema.parse("  baker@example.com ")).toBe("baker@example.com");
  });

  it("rejects malformed and over-long addresses", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
    expect(emailSchema.safeParse("baker").success).toBe(false);
    expect(emailSchema.safeParse("baker@").success).toBe(false);
    expect(emailSchema.safeParse("baker@example").success).toBe(false);
    expect(emailSchema.safeParse(`${"a".repeat(250)}@example.com`).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires length, a letter and a number", () => {
    expect(passwordSchema.safeParse("sourdough1").success).toBe(true);
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("allletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });

  it("caps the length at bcrypt's 72 byte limit", () => {
    expect(passwordSchema.safeParse(`a1${"x".repeat(70)}`).success).toBe(true);
    expect(passwordSchema.safeParse(`a1${"x".repeat(71)}`).success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("accepts international formats and rejects letters", () => {
    expect(phoneSchema.safeParse("+91 98765 43210").success).toBe(true);
    expect(phoneSchema.safeParse("(020) 7946-0000").success).toBe(true);
    expect(phoneSchema.safeParse("call me").success).toBe(false);
    expect(phoneSchema.safeParse("123").success).toBe(false);
  });
});

describe("signUpSchema", () => {
  const valid = {
    fullName: "Aarav Sharma",
    email: "aarav@example.com",
    phone: "+91 98765 43210",
    password: "sourdough1",
  };

  it("accepts a complete registration", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a missing phone but not a malformed one", () => {
    expect(signUpSchema.safeParse({ ...valid, phone: "" }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, phone: undefined }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, phone: "nope" }).success).toBe(false);
  });

  it("rejects a short name, bad email and weak password", () => {
    const result = signUpSchema.safeParse({
      fullName: "A",
      email: "not-an-email",
      phone: "",
      password: "weak",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = fieldErrorsFrom(result.error);
    expect(errors.fullName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it("does not accept role or status fields", () => {
    const parsed = signUpSchema.parse({ ...valid, role: "OWNER", status: "ACTIVE" });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("status");
  });
});

describe("signInSchema", () => {
  it("accepts any existing password without re-applying strength rules", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "old" }).success).toBe(true);
  });

  it("still bounds the submitted password length", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x".repeat(73) }).success).toBe(
      false,
    );
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("requires matching passwords", () => {
    expect(
      updatePasswordSchema.safeParse({ password: "sourdough1", confirmPassword: "sourdough1" })
        .success,
    ).toBe(true);

    const result = updatePasswordSchema.safeParse({
      password: "sourdough1",
      confirmPassword: "sourdough2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFrom(result.error).confirmPassword).toMatch(/match/i);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("validates the email only", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "a@b" }).success).toBe(false);
  });
});

describe("parseForm", () => {
  it("returns typed data for valid submissions", () => {
    const result = parseForm(
      formDataOf({ email: "baker@example.com", password: "sourdough1" }),
      signInSchema,
      ["email", "password"],
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBe("baker@example.com");
  });

  it("reports one message per field for invalid submissions", () => {
    const result = parseForm(formDataOf({ email: "", password: "" }), signInSchema, [
      "email",
      "password",
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "password"]);
  });

  it("ignores fields that were not requested", () => {
    const result = parseForm(
      formDataOf({ email: "baker@example.com", password: "sourdough1", role: "OWNER" }),
      signInSchema,
      ["email", "password"],
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).not.toHaveProperty("role");
  });

  it("treats missing fields as empty strings, not as crashes", () => {
    const result = parseForm(new FormData(), signInSchema, ["email", "password"]);
    expect(result.ok).toBe(false);
  });
});
