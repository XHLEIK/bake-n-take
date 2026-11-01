import Link from "next/link";
import { LogOut } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { signOutAction } from "@/lib/actions/auth";
import { isActive, isOwner } from "@/lib/auth/roles";
import { getSessionContext } from "@/lib/auth/session";
import { listNotifications, unreadNotificationCount } from "@/lib/orders/repository";
import { getStoreSettings } from "@/lib/store/repository";

import { AdminNav } from "./admin-nav";
import { buildAdminNav } from "./admin-sections";
import { AdminTopbar } from "./admin-topbar";

/**
 * Owner console application shell: persistent desktop sidebar, compact top
 * bar, and the page content. Server-rendered so the first HTML already knows
 * the store identity, the navigation destinations and the unread bell badge.
 *
 * Authorization boundary: the sidebar is navigation only. Every owner page
 * and server action enforces `requireOwner` itself, and RLS enforces it in
 * Postgres — rendering these links grants nothing. When there is no active
 * owner session the shell renders nothing but the page, so the page-level
 * guard can redirect (anonymous visitors never see owner chrome).
 */
export async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  if (!session || !isOwner(session.profile) || !isActive(session.profile)) {
    return <>{children}</>;
  }

  const [settings, unread, notifications] = await Promise.all([
    getStoreSettings(),
    unreadNotificationCount(session.user.id),
    listNotifications(session.user.id, 8),
  ]);

  const items = buildAdminNav(session.user.id);
  const email = session.profile.email;
  const storeName = settings?.storeName ?? "Store";

  return (
    <div className="flex min-h-dvh w-full flex-1 items-stretch">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-sidebar-ring"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex xl:w-72">
        <div className="px-5 pt-6 pb-5">
          <Link
            href={items[0]?.href ?? "/owner"}
            className="inline-block max-w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <BrandMark settings={settings} slogan />
          </Link>
          <p className="mt-3 px-1 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {storeName} · Owner console
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <AdminNav items={items} />
        </div>

        <div className="grid gap-1 border-t border-sidebar-border p-3">
          {email ? (
            <p title={email} className="truncate px-3 py-1 text-xs text-muted-foreground">
              {email}
            </p>
          ) : null}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <LogOut aria-hidden="true" className="size-[1.05rem] shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          items={items}
          settings={settings}
          email={email}
          userId={session.user.id}
          initialUnread={unread}
          initialItems={notifications}
        />
        <div id="admin-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}
