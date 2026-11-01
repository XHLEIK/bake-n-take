"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { cancelOrderAction, deleteOrderAction } from "@/lib/orders/actions";

/**
 * Customer cancellation with inline confirm.
 *
 * Only pending orders show this button; anything else is rejected by the
 * transition function too. Owners use the richer console controls.
 */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState(
    cancelOrderAction.bind(null, orderId),
    INITIAL_AUTH_FORM_STATE,
  );
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const changed = state.status === "success";
  useEffect(() => {
    if (changed) router.refresh();
  }, [changed, router]);

  return (
    <div className="grid gap-2">
      {state.status === "error" && state.message ? (
        <InlineMessage variant="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <InlineMessage variant="success" message={state.message} />
      ) : null}
      {confirming ? (
        <form action={formAction} className="flex gap-2">
          <SubmitButton pendingLabel="Cancelling…">Confirm cancellation</SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Keep order
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-11 rounded-xl px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          Cancel this order
        </button>
      )}
    </div>
  );
}

/**
 * Completed-order deletion with inline confirm, shared by the customer order
 * page and the owner console. Anything that is not completed is rejected by
 * the database function too; the action redirects server-side to the orders
 * list, so the deleted detail page can never revalidate into a 404.
 */
export function DeleteOrderButton({ orderId, returnTo }: { orderId: string; returnTo: string }) {
  const [state, formAction] = useActionState(
    deleteOrderAction.bind(null, orderId, returnTo),
    INITIAL_AUTH_FORM_STATE,
  );
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="grid gap-2">
      {state.status === "error" && state.message ? (
        <InlineMessage variant="error" message={state.message} />
      ) : null}
      {confirming ? (
        <form action={formAction} className="flex gap-2">
          <SubmitButton pendingLabel="Deleting…">Confirm delete</SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Keep order
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-11 rounded-xl px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          Delete this order
        </button>
      )}
    </div>
  );
}
