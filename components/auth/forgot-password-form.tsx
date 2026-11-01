"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Mail } from "lucide-react";

import { requestPasswordResetAction } from "@/lib/actions/auth";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";

import { FormField } from "./form-field";
import { InlineMessage } from "./inline-message";
import { SubmitButton } from "./submit-button";

/**
 * Password reset request.
 *
 * Always ends with the same message: whether an address is registered is not
 * something an unauthenticated visitor needs to learn.
 */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, INITIAL_AUTH_FORM_STATE);
  const sent = state.status === "success";

  return (
    <div className="grid gap-5">
      {sent ? (
        <InlineMessage variant="success" message={state.message ?? ""} />
      ) : (
        <form action={formAction} className="grid gap-5">
          {state.status === "error" ? (
            <InlineMessage variant="error" message={state.message ?? ""} />
          ) : null}

          <FormField
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            hint="We will send a secure link that lets you choose a new password."
            required
            icon={<Mail className="size-4" />}
            error={state.fieldErrors?.email}
          />

          <SubmitButton pendingLabel="Sending link…">Send reset link</SubmitButton>
        </form>
      )}

      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to sign in
      </Link>
    </div>
  );
}
