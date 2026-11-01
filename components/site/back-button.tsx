"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Navbar back button (isolated client island).
 *
 * Goes to the previous page via history, falling back to the storefront
 * home on direct entry (history with a single entry has nowhere to go
 * back to). Never renders on home screens — root, the customer webstore
 * home, or the owner home — where "back" has no meaning inside the app.
 * Same 40px touch target and hover language as the other header buttons.
 */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const pathname = usePathname();
  const router = useRouter();

  /*
   * Home screens have no previous page inside the app: the root, the
   * customer webstore home (the only single-segment route under
   * `/webstore`), and the owner home. Owner sub-pages (orders, products,
   * …) share the single-segment shape, so the owner home is recognized by
   * its UUID — auth user ids are always UUIDs, never route words.
   */
  const isHome =
    pathname === "/" ||
    /^\/webstore\/[^/]+\/?$/.test(pathname) ||
    /^\/owner\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(pathname);
  if (isHome) return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      title="Back"
      className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
    </button>
  );
}
