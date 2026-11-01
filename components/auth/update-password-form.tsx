"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";

import { updatePasswordAction } from "@/lib/actions/auth";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";

import { InlineMessage } from "./inline-message";
import { PasswordField } from "./password-field";
import { PasswordHints } from "./password-hints";
import { SubmitButton } from "./submit-button";

/**
 * Sets a new password for the recovery session created by the reset link.
 *
 * The session was established server-side in /auth/callback, so the user is
 * already authenticated here — this form only changes the password.
 */
export function UpdatePasswordForm({ destination }: { destination: string }) {
  const [state, formAction] = useActionState(updatePasswordAction, INITIAL_AUTH_FORM_STATE);
  const [password, setPassword] = useState("");

  if (state.status === "success") {
    return (
      <div className="grid gap-5">
        <InlineMessage variant="success" message={state.message ?? ""} />
        <Link
          href={destination}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Continue to your account
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      {state.status === "error" ? (
        <InlineMessage variant="error" message={state.message ?? ""} />
      ) : null}

      <div className="grid gap-2">
        <PasswordField
          name="password"
          label="New password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <PasswordHints value={password} />
      </div>

      <PasswordField
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pendingLabel="Updating password…">Update password</SubmitButton>
    </form>
  );
}
