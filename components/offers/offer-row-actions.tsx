"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import {
  deletePromotionAction,
  duplicatePromotionAction,
  setPromotionStatusAction,
} from "@/lib/promotions/actions";
import type { EffectiveStatus } from "@/lib/promotions/types";

/**
 * Per-offer quick actions (Phase 5).
 *
 * Pause/resume and archive run inline with refresh; duplicate and delete
 * redirect server-side. Deletion is only offered for drafts — anything with
 * history must be archived so redemptions stay auditable.
 */
export function OfferRowActions({
  promotionId,
  effective,
  baseStatus,
  hasRedemptions,
}: {
  promotionId: string;
  effective: EffectiveStatus;
  baseStatus: string;
  hasRedemptions: boolean;
}) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [toggleState, toggleAction] = useActionState(
    setPromotionStatusAction.bind(null, promotionId, effective === "paused" ? "active" : "paused"),
    INITIAL_AUTH_FORM_STATE,
  );
  const [archiveState, archiveAction] = useActionState(
    setPromotionStatusAction.bind(null, promotionId, "archived"),
    INITIAL_AUTH_FORM_STATE,
  );
  const [dupState, dupAction] = useActionState(
    async () => duplicatePromotionAction(promotionId),
    INITIAL_AUTH_FORM_STATE,
  );
  const [deleteState, deleteAction] = useActionState(
    deletePromotionAction.bind(null, promotionId),
    INITIAL_AUTH_FORM_STATE,
  );

  const changed = toggleState.status === "success" || archiveState.status === "success";
  useEffect(() => {
    if (changed) router.refresh();
  }, [changed, router]);

  const failed = [toggleState, archiveState, dupState, deleteState].find(
    (s) => s.status === "error",
  );
  const canToggle = effective === "active" || effective === "paused" || effective === "scheduled";
  const canArchive = baseStatus !== "archived";
  const canDelete = !hasRedemptions && (baseStatus === "draft" || baseStatus === "archived");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {failed?.message ? <InlineMessage variant="error" message={failed.message} /> : null}
      {canToggle ? (
        <form action={toggleAction}>
          <SubmitButton pendingLabel="Updating…" className="h-9 w-auto px-3 text-xs">
            {effective === "paused" ? "Resume" : "Pause"}
          </SubmitButton>
        </form>
      ) : null}
      <form action={dupAction}>
        <SubmitButton pendingLabel="Duplicating…" className="h-9 w-auto px-3 text-xs">
          Duplicate
        </SubmitButton>
      </form>
      {canArchive ? (
        <form action={archiveAction}>
          <SubmitButton pendingLabel="Archiving…" className="h-9 w-auto px-3 text-xs">
            Archive
          </SubmitButton>
        </form>
      ) : null}
      {canDelete ? (
        confirmingDelete ? (
          <form action={deleteAction} className="flex gap-2">
            <SubmitButton pendingLabel="Deleting…" className="h-9 w-auto px-3 text-xs">
              Confirm delete
            </SubmitButton>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-9 rounded-xl px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Keep
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="h-9 rounded-xl px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Delete…
          </button>
        )
      ) : null}
    </div>
  );
}
