"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";

import { OverlayPortal } from "./overlay-portal";

export type MobileNavLink = {
  href: string;
  label: string;
};

/**
 * Storefront mobile navigation.
 *
 * An accessible drawer: full-screen scrim, animated slide-in panel, Escape to
 * close, focus restored to the trigger, body scroll locked while open. The
 * link list is authored by the server header from real routes — this island
 * only owns the open/close choreography and the sign-out form.
 */
export function MobileNav({
  links,
  session,
}: {
  links: MobileNavLink[];
  session: { label: string; href: string; canSignOut: boolean } | null;
}) {
  // The pathname the drawer was opened on: opening flips it, any navigation
  // leaves it behind, and the drawer closes implicitly with no effect needed.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const pathname = usePathname();
  const open = openPath === pathname;
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openDrawer() {
    setOpenPath(pathname);
  }

  function closeDrawer() {
    setOpenPath(null);
  }

  // Escape closes and returns focus to the trigger. While open, both the
  // document element and the body lock scrolling (html covers iOS Safari,
  // where body-only locking is unreliable); previous values restore exactly.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const previousRoot = root.style.overflow;
    const previousBody = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousRoot;
      document.body.style.overflow = previousBody;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => openDrawer()}
        aria-expanded={open}
        aria-label="Open menu"
        className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {/*
        Portaled to document.body: the sticky header's backdrop blur creates
        a containing block, so a `fixed` overlay here would size against the
        header instead of the viewport. The panel uses real viewport height
        (100dvh, not a fraction of an ancestor) with safe-area padding for
        the iOS home indicator.
      */}
      <OverlayPortal>
        <div
          aria-hidden={!open}
          className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        >
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label="Close menu"
            onClick={() => closeDrawer()}
            className={`absolute inset-0 cursor-default bg-foreground/25 backdrop-blur-[2px] transition-opacity duration-300 ${
              open ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            role="dialog"
            aria-label="Menu"
            aria-modal={open || undefined}
            className={`absolute top-0 right-0 flex h-dvh w-[min(20rem,88vw)] flex-col gap-2 overflow-y-auto border-l border-border/60 bg-card px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Menu</p>
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  triggerRef.current?.focus();
                }}
                aria-label="Close menu"
                className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" className="size-4.5" />
              </button>
            </div>

            <nav aria-label="Store" className="mt-2 grid gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  tabIndex={open ? 0 : -1}
                  onClick={() => closeDrawer()}
                  className={`rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors hover:bg-muted ${
                    pathname === link.href ? "text-primary" : "text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {session ? (
              <div className="mt-4 grid gap-1 border-t border-border/70 pt-4">
                <Link
                  href={session.href}
                  tabIndex={open ? 0 : -1}
                  className="rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors hover:bg-muted"
                >
                  {session.label}
                </Link>
                {session.canSignOut ? (
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      tabIndex={open ? 0 : -1}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[0.9375rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <LogOut aria-hidden="true" className="size-4" />
                      Sign out
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 grid gap-2 border-t border-border/70 pt-4">
                <Link
                  href="/login"
                  tabIndex={open ? 0 : -1}
                  className="rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium hover:bg-muted"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  tabIndex={open ? 0 : -1}
                  className="brand-surface mt-1 inline-flex h-11 items-center justify-center rounded-xl text-[0.9375rem] font-semibold text-primary-foreground"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      </OverlayPortal>
    </div>
  );
}
