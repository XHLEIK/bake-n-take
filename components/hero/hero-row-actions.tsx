"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import {
  deleteHeroItemAction,
  duplicateHeroItemAction,
  moveHeroItemAction,
  setHeroStatusAction,
} from "@/lib/hero/actions";

/**
 * Per-slide quick actions (Phase 5.1).
 *
 * Enable/disable and reorder refresh inline; duplicate and delete redirect
 * server-side. System slides expose only enable/disable and reorder — their
 * content is controlled, never edited or deleted here.
 */
export function HeroRowActions({
  heroId,
  effective,
  baseStatus,
  isSystem,
}: {
  heroId: string;
  effective: string;
  baseStatus: string;
  isSystem: boolean;
}) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [toggleState, toggleAction] = useActionState(
    setHeroStatusAction.bind(null, heroId, effective === "paused" ? "active" : "paused"),
    INITIAL_AUTH_FORM_STATE,
  );
  const [upState, upAction] = useActionState(
    moveHeroItemAction.bind(null, heroId, "up"),
    INITIAL_AUTH_FORM_STATE,
  );
  const [downState, downAction] = useActionState(
    moveHeroItemAction.bind(null, heroId, "down"),
    INITIAL_AUTH_FORM_STATE,
  );
  const [archiveState, archiveAction] = useActionState(
    setHeroStatusAction.bind(null, heroId, "archived"),
    INITIAL_AUTH_FORM_STATE,
  );
  const [dupState, dupAction] = useActionState(
    async () => duplicateHeroItemAction(heroId),
    INITIAL_AUTH_FORM_STATE,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteHeroItemAction.bind(null, heroId),
    INITIAL_AUTH_FORM_STATE,
  );

  const changed = [toggleState, upState, downState, archiveState].some(
    (s) => s.status === "success",
  );
  useEffect(() => {
    if (changed) router.refresh();
  }, [changed, router]);

  const failed = [toggleState, upState, downState, archiveState, dupState, deleteState].find(
    (s) => s.status === "error",
  );
  const canToggle = effective === "active" || effective === "paused" || effective === "scheduled";
  const canArchive = baseStatus !== "archived" && !isSystem;
  const canDelete = !isSystem && (baseStatus === "draft" || baseStatus === "archived");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {failed?.message ? <InlineMessage variant="error" message={failed.message} /> : null}
      {canToggle ? (
        <form action={toggleAction}>
          <SubmitButton pendingLabel="Updating…" className="h-9 w-auto px-3 text-xs">
            {effective === "paused" ? "Enable" : "Disable"}
          </SubmitButton>
        </form>
      ) : null}
      <form action={upAction}>
        <SubmitButton pendingLabel="…" className="h-9 w-auto px-3 text-xs">
          ↑ Move up
        </SubmitButton>
      </form>
      <form action={downAction}>
        <SubmitButton pendingLabel="…" className="h-9 w-auto px-3 text-xs">
          ↓ Move down
        </SubmitButton>
      </form>
      {!isSystem ? (
        <form action={dupAction}>
          <SubmitButton pendingLabel="Duplicating…" className="h-9 w-auto px-3 text-xs">
            Duplicate
          </SubmitButton>
        </form>
      ) : null}
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
