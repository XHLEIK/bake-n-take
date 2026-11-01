import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <section className="grid gap-6">
      <AuthCard>
        <AuthHeading
          eyebrow="Password help"
          title="Reset your password"
          description="Tell us your email address and we will send a secure link to choose a new password."
          className="text-center"
        />

        <ForgotPasswordForm />
      </AuthCard>
    </section>
  );
}
