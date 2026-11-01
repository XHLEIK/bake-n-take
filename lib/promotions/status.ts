import type { EffectiveStatus, PromotionStatus } from "./types";

/**
 * Effective promotion status (Phase 5).
 *
 * Stored status is only draft/active/paused/archived. Scheduled and expired
 * are DERIVED from the validity window, so activation and expiry are
 * automatic — no cron or owner intervention. The SQL engine uses the same
 * predicate (status='active' AND dates), so both layers always agree.
 */

export function effectiveStatus(
  status: PromotionStatus,
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date(),
): EffectiveStatus {
  if (status === "archived" || status === "paused" || status === "draft") return status;
  const time = now.getTime();
  if (startsAt) {
    const start = Date.parse(startsAt);
    if (!Number.isNaN(start) && start > time) return "scheduled";
  }
  if (endsAt) {
    const end = Date.parse(endsAt);
    if (!Number.isNaN(end) && end <= time) return "expired";
  }
  return "active";
}

export const EFFECTIVE_STATUS_LABELS: Record<EffectiveStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  paused: "Paused",
  expired: "Expired",
  archived: "Archived",
};

/**
 * Legal base-status transitions for owner actions. Archived is terminal;
 * scheduling is expressed as active + a future starts_at, never a status.
 */
export function canTransitionStatus(from: PromotionStatus, to: PromotionStatus): boolean {
  if (from === to) return true;
  switch (from) {
    case "draft":
      return to === "active" || to === "archived";
    case "active":
      return to === "paused" || to === "archived";
    case "paused":
      return to === "active" || to === "archived";
    case "archived":
      return false;
  }
}
