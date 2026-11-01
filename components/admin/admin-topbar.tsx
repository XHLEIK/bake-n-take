import { NotificationBell } from "@/components/orders/notification-bell";
import { ThemeToggleHost } from "@/components/site/theme-toggle-host";
import type { StoreSettings } from "@/lib/store/types";

import { AdminMobileNav } from "./admin-mobile-nav";
import { AdminSectionTitle } from "./admin-section-title";
import type { AdminNavItem } from "./admin-sections";

/**
 * Compact admin top bar.
 *
 * Deliberately thin: the mobile menu trigger, the current-section label,
 * the notification bell and the theme toggle. Branding, navigation and
 * account controls live in the sidebar (mirrored in the mobile drawer), so
 * nothing here duplicates them.
 */
export function AdminTopbar({
  items,
  settings,
  email,
  userId,
  initialUnread,
  initialItems,
}: {
  items: AdminNavItem[];
  settings: StoreSettings | null;
  email: string | null;
  userId: string;
  initialUnread: number;
  initialItems: Parameters<typeof NotificationBell>[0]["initialItems"];
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl">
      <div className="flex h-16 w-full items-center gap-2 px-4 sm:px-6 lg:px-8">
        <AdminMobileNav items={items} settings={settings} email={email} />
        <AdminSectionTitle />
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <ThemeToggleHost />
          <NotificationBell
            userId={userId}
            initialUnread={initialUnread}
            initialItems={initialItems}
            orderBasePath="/owner/orders"
          />
        </div>
      </div>
    </header>
  );
}
