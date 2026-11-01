import { redirect } from "next/navigation";

import { dashboardPathForRole } from "@/lib/auth/roles";
import { requireOwner } from "@/lib/auth/session";

/**
 * Backwards-compatible owner entry point.
 *
 * Verifies OWNER authorization first (customers are bounced to their own
 * area, anonymous visitors to the staff entrance), then forwards to the
 * per-account URL. The canonical owner address is `/owner/[uid]`.
 */
export default async function OwnerHomeRedirect() {
  const session = await requireOwner("/owner");

  redirect(dashboardPathForRole(session.profile.role, session.user.id));
}
