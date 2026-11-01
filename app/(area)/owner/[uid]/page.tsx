import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";

import { redirectIfUidMismatch, requireOwner } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

type OwnerParams = Promise<{ uid: string }>;

/**
 * Owner dashboard.
 *
 * Intentionally minimal: dashboard reporting ships later, so this page
 * establishes only the title, the account context and a quiet empty state.
 * Day-to-day management lives in the sidebar navigation — no shortcut cards,
 * no roadmap content, no invented metrics.
 */
export default async function OwnerDashboardPage({ params }: { params: OwnerParams }) {
  const { uid } = await params;
  const session = await requireOwner(`/owner/${uid}`);

  redirectIfUidMismatch(session, uid);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Owner console
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {session.profile.email || "the owner"}
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-dashed border-border px-5 py-12 text-center sm:py-16">
        <LayoutDashboard aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
        <p className="font-medium">Nothing to review yet.</p>
        <p className="mx-auto max-w-md text-sm text-pretty text-muted-foreground">
          Orders, products, offers, hero slides and store settings are managed from the sidebar.
        </p>
      </div>
    </main>
  );
}
