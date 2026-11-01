"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { InlineMessage } from "@/components/auth/inline-message";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import {
  deleteProductAction,
  setProductActiveAction,
  setProductArchivedAction,
} from "@/lib/catalog/actions";

/**
 * Per-row quick actions for the owner product list.
 *
 * Availability toggles and archive post inline and refresh the list through
 * revalidation; deletion asks twice and navigates back to the list.
 */
export function ProductRowActions({
  productId,
  isActive,
  archived,
}: {
  productId: string;
  isActive: boolean;
  archived: boolean;
}) {
  const [activeState, activeAction] = useActionState(
    setProductActiveAction.bind(null, productId, !isActive),
    INITIAL_AUTH_FORM_STATE,
  );
  const [archiveState, archiveAction] = useActionState(
    setProductArchivedAction.bind(null, productId, !archived),
    INITIAL_AUTH_FORM_STATE,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const failed = [activeState, archiveState].find((state) => state.status === "error");

  const changed = activeState.status === "success" || archiveState.status === "success";
  const router = useRouter();
  useEffect(() => {
    if (changed) router.refresh();
  }, [changed, router]);

  return (
    <span className="grid gap-1.5">
      {failed?.message ? <InlineMessage variant="error" message={failed.message} /> : null}
      <span className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/owner/products/${productId}`}
          aria-label="Edit product"
          className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Link>
        {!archived ? (
          <form action={activeAction}>
            <button
              type="submit"
              aria-label={isActive ? "Mark unavailable" : "Mark available"}
              title={isActive ? "Mark unavailable" : "Mark available"}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                isActive ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-1 left-1 size-5 rounded-full bg-card shadow transition-transform ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
              <span className="sr-only">{isActive ? "Available" : "Unavailable"}</span>
            </button>
          </form>
        ) : null}
        <form action={archiveAction}>
          <button
            type="submit"
            aria-label={archived ? "Restore product" : "Archive product"}
            title={archived ? "Restore" : "Archive"}
            className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {archived ? (
              <RotateCcw aria-hidden="true" className="size-4" />
            ) : (
              <Archive aria-hidden="true" className="size-4" />
            )}
          </button>
        </form>
        {confirmingDelete ? (
          <form
            action={async () => {
              await deleteProductAction(productId);
            }}
            className="flex gap-1"
          >
            <button
              type="submit"
              className="h-9 rounded-xl bg-destructive px-3 text-xs font-medium text-white"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-9 rounded-xl px-2 text-xs text-muted-foreground hover:bg-muted"
            >
              Keep
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete product"
            className="grid size-9 place-items-center rounded-xl text-destructive hover:bg-destructive/10"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
      </span>
    </span>
  );
}
