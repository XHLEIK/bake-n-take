import { z } from "zod";

/**
 * Boundary validation for every authentication input.
 *
 * These schemas run on the server (Server Actions / Route Handlers) *and* on
 * the client for immediate feedback. The server run is the one that matters:
 * HTML validation is only a convenience, never a control.
 */

/** Pragmatic email rules: length caps plus a single well-formed local@domain. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

/**
 * Supabase enforces a minimum length (6 by default, 8 recommended in
 * docs/SUPABASE-SETUP.md) and bcrypt truncates beyond 72 bytes, so we cap there.
 */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use no more than 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

/** Any existing password is valid input for sign-in — never re-apply strength rules. */
const submittedPasswordSchema = z
  .string()
  .min(1, "Enter your password.")
  .max(72, "Use no more than 72 characters.");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your name.")
  .max(80, "That name is too long.");

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number.")
  .max(20, "That phone number is too long.")
  .regex(/^\+?[-()\d\s.]+$/, "Use digits, spaces, or + ( ) - only.")
  // Require a realistic number of digits regardless of formatting.
  .refine((value) => value.replace(/\D/g, "").length >= 7, "Enter a valid phone number.");

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: submittedPasswordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Repeat your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

export const ownerSignInSchema = signInSchema;

/** Remaining characters are counted in code points, not UTF-16 units. */
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_MIN_LENGTH = 8;

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export type FieldErrors = Partial<Record<string, string>>;

/** Flattens a Zod error into the first message per field (what the UI shows). */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

/** Reads string fields out of FormData, ignoring file uploads and arrays. */
export function formDataToObject(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** Validates FormData against a schema and reports field-level errors. */
export function parseForm<Schema extends z.ZodType>(
  formData: FormData,
  schema: Schema,
  fields: readonly string[],
): ParseResult<z.output<Schema>> {
  const result = schema.safeParse(formDataToObject(formData, fields));
  if (!result.success) return { ok: false, fieldErrors: fieldErrorsFrom(result.error) };
  return { ok: true, data: result.data };
}
