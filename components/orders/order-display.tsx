import { cn } from "cn";

import {
  ORDER_STATUS_DESCRIPTIONS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/lib/orders/machine";

/**
 * Shared order display primitives (Phase 4).
 *
 * Status badge, timeline and summary blocks used by both the customer order
 * pages and the owner console. Everything renders from immutable order
 * snapshots — never from live catalog rows.
 */

const BADGE_TONES: Record<OrderStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  confirmed: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  baking: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  ready_for_pickup: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        BADGE_TONES[status],
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const TIMELINE_STEPS: OrderStatus[] = [
  "pending",
  "confirmed",
  "baking",
  "ready_for_pickup",
  "completed",
];

export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <ol className="grid gap-0">
        <TimelineRow state="done" title="Order placed" />
        <TimelineRow state="cancelled" title="Cancelled" last />
      </ol>
    );
  }

  const reached = TIMELINE_STEPS.indexOf(status);
  return (
    <ol className="grid gap-0">
      {TIMELINE_STEPS.map((step, index) => (
        <TimelineRow
          key={step}
          state={index < reached ? "done" : index === reached ? "current" : "todo"}
          title={ORDER_STATUS_LABELS[step]}
          hint={index === reached ? ORDER_STATUS_DESCRIPTIONS[step] : undefined}
          last={index === TIMELINE_STEPS.length - 1}
        />
      ))}
    </ol>
  );
}

function TimelineRow({
  state,
  title,
  hint,
  last = false,
}: {
  state: "done" | "current" | "todo" | "cancelled";
  title: string;
  hint?: string;
  last?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full border text-xs shadow-[0_0_0_4px_var(--card)]",
            state === "done" && "border-primary bg-primary text-primary-foreground",
            state === "current" && "border-primary text-primary ring-4 ring-primary/15",
            state === "todo" && "border-border bg-card text-transparent",
            state === "cancelled" && "border-destructive bg-destructive/10 text-destructive",
          )}
        >
          {state === "done" ? "✓" : state === "cancelled" ? "×" : "•"}
        </span>
        {!last && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
      </span>
      <span className={cn("grid gap-0.5 pb-5", last && "pb-0")}>
        <span
          className={cn(
            "text-sm",
            state === "current"
              ? "font-semibold"
              : state === "todo"
                ? "text-muted-foreground"
                : "font-medium",
          )}
        >
          {title}
          {state === "current" ? <span className="sr-only"> (current status)</span> : null}
        </span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </li>
  );
}
