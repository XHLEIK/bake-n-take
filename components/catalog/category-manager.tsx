"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "cn";

import { FormField } from "@/components/auth/form-field";
import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/lib/catalog/actions";
import type { Category } from "@/lib/catalog/types";

/**
 * Category console, embedded in the Products area (Phase 3 revision).
 *
 * Categories are name-only groupings: create, rename inline, delete.
 * Deleting never deletes products — the database nulls their category and
 * they show as uncategorized until reassigned. Success refreshes the list
 * and the sibling product forms read fresh options on their next visit.
 */
/**
 * Category console, embedded in the Products area (Phase 3 revision).
 *
 * Categories are name-only groupings: create, rename inline, delete.
 * Deleting never deletes products — the database nulls their category and
 * they show as uncategorized until reassigned. Success refreshes the list
 * and the sibling product forms read fresh options on their next visit.
 *
 * Supporting UI by design: the manager ships collapsed so products stay the
 * primary content, and opens automatically when there is nothing to manage
 * yet. All management actions keep their existing behavior.
 */
export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, createAction] = useActionState(createCategoryAction, INITIAL_AUTH_FORM_STATE);
  const [open, setOpen] = useState(categories.length === 0);

  const created = createState.status === "success";
  useEffect(() => {
    if (!created) return;
    formRef.current?.reset();
    router.refresh();
  }, [created, router]);

  const count = categories.length;

  return (
    <section
      aria-label="Categories"
      id="categories"
      className="overflow-hidden rounded-2xl border border-border bg-card/60"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="category-manager-panel"
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[0.9375rem] font-semibold tracking-tight">Categories</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {count === 0 ? "No categories" : `${count} categor${count === 1 ? "y" : "ies"}`}
            </span>
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Manage product organization
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        id="category-manager-panel"
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-3 border-t border-border/60 p-4 sm:p-5">
            <form
              ref={formRef}
              action={createAction}
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <FormField
                  label="New category name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Chocolate Bars"
                  error={createState.fieldErrors?.name}
                />
              </div>
              <div className="sm:w-36">
                <SubmitButton pendingLabel="Creating…">
                  <Plus aria-hidden="true" className="size-4" />
                  Add
                </SubmitButton>
              </div>
            </form>
            {createState.status === "error" && createState.message ? (
              <InlineMessage variant="error" message={createState.message} />
            ) : null}
            {createState.status === "success" && createState.message ? (
              <InlineMessage variant="success" message={createState.message} />
            ) : null}

            {categories.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                No categories yet — products will show as uncategorized until you add one.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => (
                  <CategoryRow key={category.id} category={category} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [editState, editAction] = useActionState(updateCategoryAction, INITIAL_AUTH_FORM_STATE);
  const [deleteState, deleteAction] = useActionState(
    async () => deleteCategoryAction(category.id),
    INITIAL_AUTH_FORM_STATE,
  );

  // Derived closings: a confirmed save folds the editor away without syncing
  // state inside effects.
  const editing = editOpen && editState.status !== "success";
  const confirmingDelete = confirmArmed && deleteState.status !== "success";
  const changed = editState.status === "success" || deleteState.status === "success";
  useEffect(() => {
    if (changed) router.refresh();
  }, [changed, router]);

  const failed = [editState, deleteState].find((state) => state.status === "error");

  return (
    <li className="grid min-w-0 gap-2 rounded-xl border border-border/60 px-3.5 py-2 sm:px-4">
      <div className="flex items-center gap-3">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="truncate text-sm font-medium" title={`/${category.slug}`}>
            {category.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {category.productCount ?? 0} product{(category.productCount ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setDraft(category.name);
              setEditOpen((value) => !value);
            }}
            aria-label={`Rename ${category.name}`}
            aria-expanded={editing}
            className="grid size-9 place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-1">
              <form action={deleteAction}>
                <button
                  type="submit"
                  className="h-9 rounded-xl bg-destructive px-3 text-xs font-medium text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Confirm
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmArmed(false)}
                className="h-9 rounded-xl px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmArmed(true)}
              aria-label={`Delete ${category.name}`}
              title="Delete — products become uncategorized"
              className="grid size-9 place-items-center rounded-xl text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      </div>

      {failed?.message ? <InlineMessage variant="error" message={failed.message} /> : null}
      {deleteState.status === "success" && deleteState.message ? (
        <InlineMessage variant="success" message={deleteState.message} />
      ) : null}

      {editing ? (
        <form action={editAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={category.id} />
          <div className="flex-1">
            <FormField
              label="Category name"
              name="name"
              required
              maxLength={80}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              error={editState.fieldErrors?.name}
            />
          </div>
          <div className="sm:w-36">
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </div>
        </form>
      ) : null}
    </li>
  );
}
