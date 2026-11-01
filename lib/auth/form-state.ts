import type { FieldErrors } from "@/lib/validation/auth";

/**
 * Shared contract between auth Server Actions and the forms that call them.
 * Kept out of `"use server"` modules, where only async functions may be
 * exported.
 */
export type AuthFormState = {
  status: "idle" | "error" | "success";
  /** One curated message for the whole form (already safe to render). */
  message?: string;
  /** First message per field, for inline display. */
  fieldErrors?: FieldErrors;
};

export const INITIAL_AUTH_FORM_STATE: AuthFormState = { status: "idle" };

export function errorState(message: string, fieldErrors?: FieldErrors): AuthFormState {
  return { status: "error", message, fieldErrors };
}

export function successState(message: string): AuthFormState {
  return { status: "success", message };
}
