"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";

import { signInAction } from "@/lib/actions/auth";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";

import { FormField } from "./form-field";
import { InlineMessage } from "./inline-message";
import { OAuthButtons } from "./oauth-buttons";
import { PasswordField } from "./password-field";
import { SubmitButton } from "./submit-button";

/**
 * Customer sign-in.
 *
 * Progressive enhancement: the form posts to a Server Action, so it works
 * before hydration and never exposes a token to the client. `next` is passed
 * through so a deep link (for example a webstore page) survives the round trip.
 */
export function LoginForm({
  next,
  notice,
  initialError,
  requireOwner = false,
}: {
  next?: string;
  notice?: string;
  /** Message describing why the visitor landed here (from `/login?error=`). */
  initialError?: string;
  /** Owner entrance: only OWNER profiles may complete this form. */
  requireOwner?: boolean;
}) {
  const [state, formAction] = useActionState(signInAction, INITIAL_AUTH_FORM_STATE);

  return (
    <div className="grid gap-5 lg:gap-[var(--auth-gap,1.5rem)]">
      {initialError ? (
        <InlineMessage variant="error" message={initialError} />
      ) : notice ? (
        <InlineMessage variant="info" message={notice} />
      ) : null}

      <form action={formAction} className="grid gap-4 lg:gap-[var(--auth-gap,1.25rem)]">
        <input type="hidden" name="next" value={next ?? ""} />
        {requireOwner ? <input type="hidden" name="requireOwner" value="1" /> : null}

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
          required
          icon={<Mail className="size-4" />}
          error={state.fieldErrors?.email}
        />

        <div className="grid gap-2">
          <PasswordField
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            error={state.fieldErrors?.password}
          />
          <Link
            href="/forgot-password"
            className="justify-self-end text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>

      <AuthDivider />

      <OAuthButtons next={next} />
    </div>
  );
}

/** "or" rule between the email form and the social buttons. */
export function AuthDivider() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-4 text-[0.6875rem] font-medium tracking-[0.18em] text-muted-foreground/80 uppercase"
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
      <span>or</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
    </div>
  );
}
