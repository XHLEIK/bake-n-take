import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { authErrorMessage, searchParamErrorCode } from "@/lib/auth/errors";
import { authNoticeMessage, searchParamNoticeCode } from "@/lib/auth/notices";
import { safeNextPath } from "@/lib/auth/paths";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/store/repository";

export const metadata: Metadata = { title: "Sign in" };

type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const params = await searchParams;
  const error = searchParamErrorCode(params);
  const notice = searchParamNoticeCode(params);

  // Already signed in? Go to the right area. Skipped when an error is being
  // shown, so a session without a profile cannot bounce in a redirect loop.
  await redirectIfAuthenticated(error);

  const settings = await getStoreSettings();
  const storeName = settings?.storeName;

  return (
    <section className="grid gap-4 lg:gap-[var(--auth-gap,1.5rem)]">
      <AuthCard>
        <AuthHeading
          eyebrow="Welcome back"
          title={storeName ? `Sign in to ${storeName}` : "Sign in"}
          description={
            settings?.tagline
              ? undefined
              : "Your saved details and orders are waiting on the other side."
          }
          className="text-center"
        />

        <LoginForm
          next={safeNextPath(params.next, "") || undefined}
          notice={notice ? authNoticeMessage(notice) : undefined}
          initialError={error ? authErrorMessage(error) : undefined}
        />
      </AuthCard>

      <p className="text-center text-sm text-muted-foreground">
        {storeName ? `New to ${storeName}?` : "New here?"}{" "}
        <Link
          href="/signup"
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>

      <p className="border-t border-border/60 pt-5 text-center text-xs text-muted-foreground">
        Bakery owner?{" "}
        <Link
          href="/owner/login"
          className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Use the owner sign-in
        </Link>
      </p>
    </section>
  );
}
