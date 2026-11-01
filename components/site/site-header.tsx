import Link from "next/link";
import { LogOut, ShoppingBag } from "lucide-react";
import { cn } from "cn";

import { BrandMark } from "@/components/brand/brand-mark";
import { BackButton } from "@/components/site/back-button";
import { MobileNav, type MobileNavLink } from "@/components/site/mobile-nav";
import { NotificationBell } from "@/components/orders/notification-bell";
import { ThemeToggleHost } from "@/components/site/theme-toggle-host";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { getSessionContext } from "@/lib/auth/session";
import { isActive } from "@/lib/auth/roles";
import { getCart, listNotifications, unreadNotificationCount } from "@/lib/orders/repository";
import { getStoreSettings } from "@/lib/store/repository";

/**
 * Customer storefront header.
 *
 * Server-rendered so the first HTML already knows the session, the live cart
 * count and the unread bell badge — no layout shift, no client role logic.
 * Real route links (Home, Bake list, About, Contact, My orders) come from
 * the discovered routes; the mobile drawer receives the same list plus Cart. Branding and tagline are
 * store-settings driven.
 */
export async function SiteHeader({
  destination,
}: {
  /** Set when an ACTIVE session exists; where "My account" should link to. */
  destination?: string | null;
}) {
  const [settings, session] = await Promise.all([getStoreSettings(), getSessionContext()]);
  const active = session && isActive(session.profile) ? session : null;

  const [cartCount, unread, notifications] = active
    ? await Promise.all([
        getCart(active.user.id).then((cart) => cart?.unitCount ?? 0),
        unreadNotificationCount(active.user.id),
        listNotifications(active.user.id, 8),
      ])
    : [0, 0, []];

  const orderBasePath =
    active && active.profile.role === "OWNER"
      ? "/owner/orders"
      : `/webstore/${active?.user.id}/orders`;

  const webstore = active && active.profile.role !== "OWNER" ? `/webstore/${active.user.id}` : null;

  const storeLinks: MobileNavLink[] = webstore
    ? [
        { href: webstore, label: "Home" },
        { href: `${webstore}/shop`, label: "Bake list" },
        { href: `${webstore}#about`, label: "About" },
        { href: `${webstore}#contact`, label: "Contact" },
        { href: `${webstore}/orders`, label: "My orders" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/login", label: "Bake list" },
      ];

  // Cart lives in the header icon (with live count) on sm+ screens; the
  // mobile drawer gets an explicit Cart row since the icon hides on xs.
  const cartLink: MobileNavLink | null = webstore
    ? { href: `${webstore}/cart`, label: "Cart" }
    : null;
  const drawerLinks = cartLink ? [...storeLinks, cartLink] : storeLinks;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-1">
          <BackButton fallbackHref={webstore ?? "/"} />
          <Link
            href="/"
            aria-label={settings ? `${settings.storeName} home` : "Store home"}
            className="min-w-0 rounded-xl"
          >
            <BrandMark settings={settings} slogan />
          </Link>
        </div>

        {/* Desktop store links: only when we know the customer's webstore. */}
        {webstore ? (
          <nav aria-label="Store" className="hidden items-center gap-1 lg:flex">
            {storeLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-1 sm:gap-1.5">
          <ThemeToggleHost />

          {active && destination ? (
            <>
              {active.profile.role !== "OWNER" ? (
                <Link
                  href={`/webstore/${active.user.id}/cart`}
                  aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
                  title="Cart"
                  className="relative hidden size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid"
                >
                  <ShoppingBag aria-hidden="true" className="size-[1.05rem]" />
                  {cartCount > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                    >
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
              <NotificationBell
                userId={active.user.id}
                initialUnread={unread}
                initialItems={notifications}
                orderBasePath={orderBasePath}
              />
              <Link
                href={destination}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "default" }),
                  "hidden h-10 rounded-xl px-3.5 text-sm sm:inline-flex",
                )}
              >
                My account
              </Link>
              <form action={signOutAction} className="hidden sm:block">
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-lg"
                  className="size-10 rounded-xl"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "hidden h-10 rounded-xl px-3.5 text-sm sm:inline-flex",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "hidden h-10 rounded-xl px-3.5 text-sm sm:inline-flex",
                )}
              >
                Create account
              </Link>
            </>
          )}

          <MobileNav
            links={drawerLinks}
            session={
              active && destination
                ? {
                    label: "My account",
                    href: destination,
                    canSignOut: true,
                  }
                : null
            }
          />
        </div>
      </div>
    </header>
  );
}
