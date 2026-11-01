"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { subscribeNewsletterAction } from "@/lib/newsletter/actions";

/**
 * Newsletter subscribe form (Phase 6).
 *
 * One email field with inline validation, a pending state on the button,
 * and a curated success/error message — the same form contract every other
 * storefront form uses. Duplicate addresses resolve to a friendly
 * confirmation server-side, never an error.
 */
export function NewsletterForm() {
  const [state, formAction] = useActionState(subscribeNewsletterAction, INITIAL_AUTH_FORM_STATE);

  return (
    <form action={formAction} className="grid gap-3">
      {state.status === "error" && state.message ? (
        <InlineMessage variant="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <InlineMessage variant="success" message={state.message} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <FormField
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          icon={<Mail className="size-4" />}
          error={state.fieldErrors?.email}
        />
        <div className="sm:w-44">
          <SubmitButton pendingLabel="Joining…">Subscribe</SubmitButton>
        </div>
      </div>
    </form>
  );
}
