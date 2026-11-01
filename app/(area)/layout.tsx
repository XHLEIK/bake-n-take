import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { dashboardPathForRole, isActive, isOwner } from "@/lib/auth/roles";
import { getSessionContext } from "@/lib/auth/session";

/**
 * Shell for the protected areas.
 *
 * The header needs to know whether a session exists, so this layout reads the
 * verified session rather than trusting the URL or a client-side flag. The
 * footer renders the database-driven store identity below every area page.
 *
 * Owner-console routes (`/owner/*`) render their own admin shell (sidebar +
 * top bar) via `app/(area)/owner/layout.tsx`, so the storefront header and
 * footer must not wrap them — that would duplicate navigation and account
 * controls.
 */
export default async function AreaLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();

  if (session && isActive(session.profile) && isOwner(session.profile)) {
    return <>{children}</>;
  }

  const destination =
    session && isActive(session.profile)
      ? dashboardPathForRole(session.profile.role, session.user.id)
      : null;

  return (
    <>
      <SiteHeader destination={destination} />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
