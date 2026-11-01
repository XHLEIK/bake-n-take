"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { OverlayPortal } from "@/components/site/overlay-portal";
import { signOutAction } from "@/lib/actions/auth";
import type { StoreSettings } from "@/lib/store/types";

import { AdminNav } from "./admin-nav";
import type { AdminNavItem } from "./admin-sections";

/**
 * Admin mobile navigation: trigger button (rendered inside the top bar) plus
 * a left slide-over drawer. Same proven choreography as the storefront
 * drawer — Escape closes with focus restore, body scroll locks while open,
 * navigation closes implicitly, and the panel portals to `document.body` so
 * the sticky top bar's backdrop blur cannot clip it.
 */
export function AdminMobileNav({
  items,
  settings,
  email,
}: {
  items: AdminNavItem[];
  settings: StoreSettings | null;
  email: string | null;
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
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => openDrawer()}
        aria-expanded={open}
        aria-label="Open admin menu"
        className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <OverlayPortal>
        <div
          aria-hidden={!open}
          className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        >
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label="Close admin menu"
            onClick={() => closeDrawer()}
            className={`absolute inset-0 cursor-default bg-foreground/25 transition-opacity duration-300 motion-reduce:transition-none ${
              open ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            role="dialog"
            aria-label="Admin menu"
            aria-modal={open || undefined}
            className={`absolute top-0 left-0 flex h-dvh w-[min(20rem,88vw)] flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sidebar-foreground shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              open ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                href={items[0]?.href ?? "/owner"}
                tabIndex={open ? 0 : -1}
                onClick={() => closeDrawer()}
                className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <BrandMark settings={settings} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  triggerRef.current?.focus();
                }}
                tabIndex={open ? 0 : -1}
                aria-label="Close admin menu"
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <X aria-hidden="true" className="size-4.5" />
              </button>
            </div>

            <AdminNav items={items} onNavigate={() => closeDrawer()} />

            <div className="mt-auto grid gap-1 border-t border-sidebar-border pt-4">
              {email ? (
                <p title={email} className="truncate px-3 py-1 text-xs text-muted-foreground">
                  {email}
                </p>
              ) : null}
              <form action={signOutAction}>
                <button
                  type="submit"
                  tabIndex={open ? 0 : -1}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <LogOut aria-hidden="true" className="size-[1.05rem] shrink-0" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </OverlayPortal>
    </>
  );
}
