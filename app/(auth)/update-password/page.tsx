import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeading } from "@/components/auth/auth-heading";
import { InlineMessage } from "@/components/auth/inline-message";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { authErrorMessage } from "@/lib/auth/errors";
import { dashboardPathForRole, isActive } from "@/lib/auth/roles";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * Final step of the reset flow.
 *
 * The recovery session was created server-side in /auth/callback, so this page
 * simply checks that the session is real and active. No token is read from the
 * URL here.
 */
export default async function UpdatePasswordPage() {
  const session = await getSessionContext();

  if (!session || !isActive(session.profile)) {
    return (
      <section className="grid gap-6">
        <AuthCard>
          <AuthHeading
            eyebrow="Password help"
            title="That link has expired"
            description="Reset links are single-use and time-limited. Request a fresh one and we will email it right away."
            className="text-center"
          />
          <InlineMessage variant="error" message={authErrorMessage("session_expired")} />
        </AuthCard>
        <Link
          href="/forgot-password"
          className="rounded-sm text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Request a new reset link
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <AuthCard>
        <AuthHeading
          eyebrow="Almost done"
          title="Choose a new password"
          description="Pick something memorable but hard to guess. You will stay signed in on this device."
          className="text-center"
        />
        <UpdatePasswordForm
          destination={dashboardPathForRole(session.profile.role, session.user.id)}
        />
      </AuthCard>
    </section>
  );
}
