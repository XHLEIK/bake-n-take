"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Images,
  LayoutDashboard,
  Package,
  Settings2,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { cn } from "cn";

import { isNavActive, type AdminIconName, type AdminNavItem } from "./admin-sections";

const ICONS: Record<AdminIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  products: Package,
  offers: BadgePercent,
  hero: Images,
  settings: Settings2,
};

/**
 * Primary admin navigation list, shared by the desktop sidebar and the
 * mobile drawer. The item list is authored on the server from real routes;
 * this island only resolves the active state from the pathname.
 */
export function AdminNav({
  items,
  onNavigate,
}: {
  items: AdminNavItem[];
  /** Called when a destination is chosen (used to close the mobile drawer). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin">
      <ul className="grid gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isNavActive(pathname, item);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("size-[1.05rem] shrink-0", active && "text-sidebar-primary")}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
