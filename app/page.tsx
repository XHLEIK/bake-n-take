import { redirect } from "next/navigation";

import { dashboardPathForRole, isActive } from "@/lib/auth/roles";
import { getSessionContext } from "@/lib/auth/session";

/**
 * The site root shows nothing of its own.
 *
 * Signed-in visitors go straight to their area; everyone else goes to the
 * sign-in page. The session is verified server-side, so this cannot be
 * bypassed from the browser.
 */
export default async function HomePage() {
  const session = await getSessionContext();

  if (session && isActive(session.profile)) {
    redirect(dashboardPathForRole(session.profile.role, session.user.id));
  }

  redirect("/login");
}
