/**
 * Order status state machine (Phase 4).
 *
 * ```text
 * pending → confirmed → baking → ready_for_pickup → completed
 *    ↓          ↓           ↓              ↓
 * cancelled  cancelled  cancelled      cancelled
 * ```
 *
 * Customers may only cancel their own pending order. Owners may advance any
 * forward step or cancel anything unfinished. NOTHING else is legal.
 *
 * This map drives UI affordances only. Enforcement lives in the
 * `transition_order` database function, so a compromised client or a future
 * API caller can never bypass it — both layers share these exact rules.
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "baking",
  "ready_for_pickup",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["baking", "cancelled"],
  baking: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** All legal targets from a status, irrespective of role. */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[from]];
}

/**
 * Whether a role may move an order along one edge. Mirrors the database
 * function exactly: owner = any legal edge; customer = cancel own pending.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: "OWNER" | "CUSTOMER",
): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (role === "OWNER") return true;
  return from === "pending" && to === "cancelled";
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  baking: "Baking",
  ready_for_pickup: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: "Received — waiting for the bakery to confirm.",
  confirmed: "Confirmed — the bakery accepted the order.",
  baking: "Being prepared fresh for pickup.",
  ready_for_pickup: "Ready — come and collect it.",
  completed: "Picked up. Thank you!",
  cancelled: "This order was cancelled.",
};

/** Owner action buttons, in lifecycle order. */
export const OWNER_NEXT_ACTIONS: { status: OrderStatus; label: string; terminal?: boolean }[] = [
  { status: "confirmed", label: "Confirm order" },
  { status: "baking", label: "Start baking" },
  { status: "ready_for_pickup", label: "Mark ready for pickup" },
  { status: "completed", label: "Complete order" },
  { status: "cancelled", label: "Cancel order", terminal: true },
];
