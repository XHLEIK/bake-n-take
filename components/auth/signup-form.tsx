"use client";

import { useActionState, useState } from "react";
import { Mail, Phone, User } from "lucide-react";

import { signUpAction } from "@/lib/actions/auth";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";

import { AuthDivider } from "./login-form";
import { FormField } from "./form-field";
import { InlineMessage } from "./inline-message";
import { OAuthButtons } from "./oauth-buttons";
import { PasswordField } from "./password-field";
import { PasswordHints } from "./password-hints";
import { SubmitButton } from "./submit-button";

/**
 * Customer registration.
 *
 * Collects only what the bakery needs to serve an order: name, email, an
 * optional phone number, and a password. No address, birthday, marketing
 * consent, or role — there is nothing here a customer could inflate.
 */
export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, INITIAL_AUTH_FORM_STATE);
  const [password, setPassword] = useState("");

  return (
    <div className="grid gap-5 lg:gap-[var(--auth-gap,1.5rem)]">
      <form action={formAction} className="grid gap-4 lg:gap-[var(--auth-gap,1.25rem)]">
        {state.status === "error" ? (
          <InlineMessage variant="error" message={state.message ?? ""} />
        ) : null}

        <FormField
          label="Your name"
          name="fullName"
          autoComplete="name"
          placeholder="Aarav Sharma"
          required
          maxLength={80}
          icon={<User className="size-4" />}
          error={state.fieldErrors?.fullName}
        />

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

        <FormField
          label="Phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Phone number (optional)"
          hint="Only used to reach you about an order."
          icon={<Phone className="size-4" />}
          error={state.fieldErrors?.phone}
        />

        <div className="grid gap-2">
          <PasswordField
            name="password"
            label="Password"
            autoComplete="new-password"
            required
            error={state.fieldErrors?.password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <PasswordHints value={password} />
        </div>

        <SubmitButton pendingLabel="Creating your account…">Create account</SubmitButton>
      </form>

      <AuthDivider />

      <OAuthButtons />
    </div>
  );
}
