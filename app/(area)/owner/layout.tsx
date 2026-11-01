import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Owner console layout.
 *
 * Every `/owner/*` route renders inside the admin application shell
 * (persistent sidebar + compact top bar). The shell itself renders no owner
 * chrome without an active owner session, so page-level `requireOwner`
 * guards keep redirecting anonymous or customer visitors exactly as before.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
