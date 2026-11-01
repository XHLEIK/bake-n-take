"use server";

import { z } from "zod";

import { errorState, successState, type AuthFormState } from "@/lib/auth/form-state";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const subscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email address is too long.")
    .refine((value) => z.email().safeParse(value).success, "Enter a valid email address."),
});

/**
 * Newsletter subscribe path (Phase 6).
 *
 * The homepage section is only reachable signed in, and the insert is
 * attributed to the caller (RLS enforces `customer_id = auth.uid()`).
 * Duplicate addresses collapse to a friendly confirmation instead of an
 * error — subscribing twice is not a failure.
 */
export async function subscribeNewsletterAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await getSessionContext();
  if (!session) return errorState("Please sign in to subscribe.");

  const raw = formData.get("email");
  const parsed = subscribeSchema.safeParse({ email: typeof raw === "string" ? raw : "" });
  if (!parsed.success) {
    return errorState("Enter a valid email address.", {
      email: "Enter a valid email address.",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_subscriptions").insert({
    email: parsed.data.email,
    customer_id: session.user.id,
  });

  if (error) {
    // Unique-address violation: already on the list — confirm, don't scold.
    if (error.code === "23505") {
      return successState("You're already on the list — fresh news will find you.");
    }
    return errorState("We could not save your subscription. Please try again.");
  }

  return successState("Welcome to the family — fresh news will find you.");
}
