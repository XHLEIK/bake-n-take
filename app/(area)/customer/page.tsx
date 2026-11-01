import { redirect } from "next/navigation";

import { dashboardPathForRole } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";

/**
 * Backwards-compatible customer entry point.
 *
 * Verifies the session first (anonymous visitors still land on `/login` with
 * a `next` hint), then forwards to the per-account URL. The canonical
 * customer address is `/webstore/[uid]`; this route only exists so old links
 * and bookmarks keep working.
 */
export default async function CustomerHomeRedirect() {
  const session = await requireUser("/customer");

  redirect(dashboardPathForRole(session.profile.role, session.user.id));
}
