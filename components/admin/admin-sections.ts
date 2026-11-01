/**
 * Admin navigation model (owner console).
 *
 * Pure, server-safe helpers shared by the desktop sidebar, the mobile drawer
 * and the top-bar section title. Hrefs reuse the existing owner routes — no
 * duplicate routes are introduced here. "Dashboard" is the owner home
 * (`/owner/[uid]`); every other entry points at the long-standing static
 * management routes.
 */

export type AdminIconName = "dashboard" | "orders" | "products" | "offers" | "hero" | "settings";

export type AdminNavItem = {
  key: string;
  label: string;
  href: string;
  icon: AdminIconName;
};

/** Final navigation order: Dashboard first, then the five management areas. */
export function buildAdminNav(ownerUid: string): AdminNavItem[] {
  return [
    { key: "dashboard", label: "Dashboard", href: `/owner/${ownerUid}`, icon: "dashboard" },
    { key: "orders", label: "Orders", href: "/owner/orders", icon: "orders" },
    { key: "products", label: "Products", href: "/owner/products", icon: "products" },
    { key: "offers", label: "Offers", href: "/owner/offers", icon: "offers" },
    { key: "hero", label: "Hero Carousel", href: "/owner/hero", icon: "hero" },
    { key: "settings", label: "Store Settings", href: "/owner/settings", icon: "settings" },
  ];
}

/**
 * Active-state predicate. Dashboard matches exactly (it shares the `/owner/`
 * prefix with everything); section roots match themselves and their subpages
 * (`/owner/orders/…`), never siblings (`/owner/ordersX` cannot happen because
 * the trailing slash is required).
 */
export function isNavActive(pathname: string, item: AdminNavItem): boolean {
  if (pathname === item.href) return true;
  if (item.key === "dashboard") return false;
  return pathname.startsWith(`${item.href}/`);
}

/**
 * Section label for the top bar, derived from the pathname. Returns null for
 * non-owner paths (e.g. the public staff entrance `/owner/login`, which never
 * renders inside the shell).
 */
export function sectionForPath(pathname: string): string | null {
  if (!pathname.startsWith("/owner")) return null;
  const rest = pathname.slice("/owner".length);
  if (rest === "" || rest === "/") return "Dashboard";
  const segment = rest.split("/").filter(Boolean)[0] ?? "";
  switch (segment) {
    case "orders":
      return "Orders";
    case "products":
      return "Products";
    case "offers":
      return "Offers";
    case "hero":
      return "Hero Carousel";
    case "settings":
      return "Store Settings";
    case "login":
      return null;
    default:
      // Single unknown segment = the per-account dashboard (`/owner/[uid]`).
      return rest.split("/").filter(Boolean).length === 1 ? "Dashboard" : null;
  }
}
