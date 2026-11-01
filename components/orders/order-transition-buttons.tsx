"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { transitionOrderAction } from "@/lib/orders/actions";
import { OWNER_NEXT_ACTIONS, canTransition, type OrderStatus } from "@/lib/orders/machine";

/**
 * Owner status controls (Phase 4).
 *
 * Only the transitions legal from the current status render as buttons; the
 * database function re-validates every edge, so hidden buttons are convenience,
 * never the security boundary. Completing an order additionally requires the
 * paid checkbox — the payment row flips to success in the same transaction.
 * Cancellation asks twice.
 */
export function OrderTransitionButtons({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [state, formAction] = useActionState(
    async (_previous: typeof INITIAL_AUTH_FORM_STATE, formData: FormData) => {
      const target = String(formData.get("target") ?? "");
      // Completing an order requires the paid confirmation; the database
      // flips the payment row in the same transaction as the status change.
      const paymentReceived = formData.get("paid") === "on";
      return transitionOrderAction(orderId, target, { paymentReceived });
    },
    INITIAL_AUTH_FORM_STATE,
  );
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const router = useRouter();

  // Fresh server props after a committed transition (no setState inside).
  const changed = state.status === "success";
  useEffect(() => {
    if (changed) router.refresh();
  }, [changed, router]);

  const forward = OWNER_NEXT_ACTIONS.filter(
    (action) => !action.terminal && canTransition(status, action.status, "OWNER"),
  );
  const cancellable = canTransition(status, "cancelled", "OWNER");

  if (forward.length === 0 && !cancellable) {
    return (
      <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
        This order is {status.replace(/_/g, " ")} — no further changes apply.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {state.status !== "idle" && state.message ? (
        <InlineMessage
          variant={state.status === "error" ? "error" : "success"}
          message={state.message}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {forward.map((action) =>
          action.status === "completed" ? (
            <form
              key={action.status}
              action={formAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="target" value={action.status} />
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium has-checked:border-primary has-checked:bg-primary/10">
                <input
                  type="checkbox"
                  name="paid"
                  value="on"
                  required
                  className="size-4 accent-primary"
                />
                Payment received
              </label>
              <SubmitButton pendingLabel="Updating…">{action.label}</SubmitButton>
            </form>
          ) : (
            <form key={action.status} action={formAction}>
              <input type="hidden" name="target" value={action.status} />
              <SubmitButton pendingLabel="Updating…">{action.label}</SubmitButton>
            </form>
          ),
        )}
        {cancellable ? (
          confirmingCancel ? (
            <form action={formAction} className="flex gap-2">
              <input type="hidden" name="target" value="cancelled" />
              <SubmitButton pendingLabel="Cancelling…">Confirm cancel</SubmitButton>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Keep
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="h-11 rounded-xl px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Cancel order…
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
