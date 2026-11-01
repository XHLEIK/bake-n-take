import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { redirectIfOwner } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Owner sign in" };

type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Owner sign-in.
 *
 * Visually distinct from the customer experience, but the same Supabase Auth
 * underneath. The `requireOwner` flag makes the server action refuse (and sign
 * out) any profile that is not an ACTIVE OWNER, so a customer account cannot
 * use this door.
 */
export default async function OwnerLoginPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const params = await searchParams;
  const error = searchParamErrorCode(params);

  await redirectIfOwner(error);

  return (
    <section className="grid gap-4 lg:gap-[var(--auth-gap,1.5rem)]">
      <AuthCard>
        <span className="inline-flex w-fit items-center gap-1.5 justify-self-center rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-[0_1px_0_rgb(255_255_255/0.5)_inset] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <ShieldCheck aria-hidden="true" className="size-3.5 text-primary" />
          Staff entrance
        </span>

        <AuthHeading
          eyebrow="Owner access"
          title="Owner sign in"
          description="For the bakery owner and staff accounts. Access is checked against the owner role on the server."
          className="text-center"
        />
        {/* Owner page keeps its explanatory line: it is a distinct entrance, not a tagline repeat. */}

        <LoginForm
          next="/owner"
          requireOwner
          initialError={error ? authErrorMessage(error) : undefined}
        />
      </AuthCard>

      <p className="border-t border-border/60 pt-5 text-center text-xs text-muted-foreground">
        Not the owner?{" "}
        <Link
          href="/login"
          className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Customer sign in
        </Link>
      </p>
    </section>
  );
}
