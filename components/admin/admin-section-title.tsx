"use client";

import { usePathname } from "next/navigation";

import { sectionForPath } from "./admin-sections";

/**
 * Current-section label for the admin top bar. Client-side because it reads
 * the pathname; the mapping itself is the shared server-safe helper.
 */
export function AdminSectionTitle() {
  const pathname = usePathname();
  const section = sectionForPath(pathname) ?? "Dashboard";
  return (
    <p aria-live="polite" className="truncate text-sm font-semibold tracking-tight text-foreground">
      {section}
    </p>
  );
}
