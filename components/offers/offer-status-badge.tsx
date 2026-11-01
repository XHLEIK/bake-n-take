import { cn } from "cn";

import { EFFECTIVE_STATUS_LABELS } from "@/lib/promotions/status";
import type { EffectiveStatus } from "@/lib/promotions/types";

/**
 * Offer status badge (Phase 5).
 *
 * Shows the EFFECTIVE status (scheduled/expired derived from dates), so the
 * owner sees exactly what customers see without manual intervention.
 */
const STYLES: Record<EffectiveStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  expired: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

export function OfferStatusBadge({
  status,
  className,
}: {
  status: EffectiveStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-wide uppercase",
        STYLES[status],
        className,
      )}
    >
      {EFFECTIVE_STATUS_LABELS[status]}
    </span>
  );
}
