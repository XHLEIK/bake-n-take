import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/signup-form";
import { searchParamErrorCode } from "@/lib/auth/errors";
import { redirectIfAuthenticated } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your account" };

type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignUpPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const params = await searchParams;
  await redirectIfAuthenticated(searchParamErrorCode(params));

  return (
    <section className="gap-4 grid lg:gap-[var(--auth-gap,1.5rem)]">
      <AuthCard>
        <AuthHeading
          eyebrow="Join the bakery"
          title="Create your account"
          description="It takes a moment. You can add more later, this is all we need to get you started."
          className="text-center"
          descriptionClassName="lg:[display:var(--auth-desc-display,block)]"
        />

        <SignUpForm />
      </AuthCard>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
