"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";

import { validateImageUpload } from "@/lib/store/validation";

/**
 * Product image manager (owner console).
 *
 * Saved images are edited in place (alt text, primary star, reorder, staged
 * removal with inline confirm); newly picked files stage locally with live
 * previews and sync into a hidden file input on submit, so the save action
 * receives real Files. Nothing uploads before save.
 */

export type ExistingImageDraft = {
  id: string;
  url: string | null;
  altText: string;
  isPrimary: boolean;
  removed: boolean;
  confirmingRemove: boolean;
};

export type StagedFile = {
  key: string;
  file: File;
  preview: string;
};

export function ImageManager({
  existing,
  onExistingChange,
  staged,
  onStagedChange,
  error,
}: {
  existing: ExistingImageDraft[];
  onExistingChange: (rows: ExistingImageDraft[]) => void;
  staged: StagedFile[];
  onStagedChange: (files: StagedFile[]) => void;
  error?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // The save action reads real Files from this input; state stays the source
  // of truth for previews, order and removal. Skipped where DataTransfer is
  // unavailable — the server still receives whatever the input holds.
  function syncInput(files: StagedFile[]) {
    const input = fileRef.current;
    if (!input || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    for (const entry of files) transfer.items.add(entry.file);
    input.files = transfer.files;
  }

  useEffect(() => {
    syncInput(staged);
  }, [staged]);

  async function pick(files: FileList | null) {
    setLocalError(null);
    if (!files) return;
    const accepted: StagedFile[] = [];
    for (const file of Array.from(files)) {
      if (staged.length + accepted.length >= 12) {
        setLocalError("At most 12 images per product.");
        break;
      }
      const checked = await validateImageUpload(file);
      if (!checked.ok) {
        setLocalError(`${file.name}: ${checked.error}`);
        continue;
      }
      accepted.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }
    if (accepted.length > 0) onStagedChange([...staged, ...accepted]);
    if (fileRef.current) fileRef.current.value = "";
    // Re-sync after clearing: the effect above runs on staged change only, so
    // re-apply here to keep previously staged files.
    requestAnimationFrame(() => syncInput([...staged, ...accepted]));
  }

  function moveStaged(key: string, direction: -1 | 1) {
    const index = staged.findIndex((entry) => entry.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= staged.length) return;
    const next = [...staged];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onStagedChange(next);
  }

  function patchExisting(id: string, patch: Partial<ExistingImageDraft>) {
    onExistingChange(existing.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const visibleExisting = existing.filter((row) => !row.removed);

  return (
    <div className="grid gap-3">
      {visibleExisting.length === 0 && staged.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          No images yet. Add the first one below — it becomes the primary image.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {visibleExisting.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[64px_1fr] gap-3 rounded-xl border border-border p-3"
          >
            <span className="relative block size-16 overflow-hidden rounded-lg bg-muted/40">
              {row.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.url} alt="" className="size-full object-cover" />
              ) : null}
              {row.isPrimary ? (
                <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  <Star aria-hidden="true" className="size-2.5" />
                  Primary
                </span>
              ) : null}
            </span>
            <div className="grid gap-1.5">
              <label className="sr-only" htmlFor={`image-alt-${row.id}`}>
                Describe this image
              </label>
              <input
                id={`image-alt-${row.id}`}
                value={row.altText}
                maxLength={160}
                placeholder="Alt text, e.g. Chocolate cake slice"
                onChange={(event) => patchExisting(row.id, { altText: event.currentTarget.value })}
                className="h-9 rounded-lg border border-input bg-card px-2 text-xs"
              />
              <div className="flex items-center gap-1">
                {!row.isPrimary ? (
                  <button
                    type="button"
                    onClick={() =>
                      onExistingChange(
                        existing.map((entry) => ({ ...entry, isPrimary: entry.id === row.id })),
                      )
                    }
                    aria-label="Make primary image"
                    title="Make primary"
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Star aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
                {row.confirmingRemove ? (
                  <>
                    <button
                      type="button"
                      onClick={() => patchExisting(row.id, { removed: true })}
                      className="h-8 rounded-lg bg-destructive px-2.5 text-xs font-medium text-white"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => patchExisting(row.id, { confirmingRemove: false })}
                      className="h-8 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => patchExisting(row.id, { confirmingRemove: true })}
                    aria-label="Remove image"
                    className="grid size-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}

        {staged.map((entry, index) => (
          <li
            key={entry.key}
            className="grid grid-cols-[64px_1fr] gap-3 rounded-xl border border-dashed border-primary/40 p-3"
          >
            <span className="block size-16 overflow-hidden rounded-lg bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.preview} alt="" className="size-full object-cover" />
            </span>
            <div className="grid gap-1.5">
              <p className="truncate text-xs font-medium" title={entry.file.name}>
                {entry.file.name}
              </p>
              <p className="text-[11px] text-muted-foreground">Uploads when you save.</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveStaged(entry.key, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${entry.file.name} earlier`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStaged(entry.key, 1)}
                  disabled={index === staged.length - 1}
                  aria-label={`Move ${entry.file.name} later`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onStagedChange(staged.filter((item) => item.key !== entry.key))}
                  aria-label={`Discard ${entry.file.name}`}
                  className="grid size-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div>
        <label
          htmlFor={inputId}
          className="inline-flex h-10 w-fit cursor-pointer items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          <ImagePlus aria-hidden="true" className="size-4" />
          Add images
        </label>
        <input
          ref={fileRef}
          id={inputId}
          name="newImages"
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          className="sr-only"
          onChange={(event) => void pick(event.currentTarget.files)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          PNG, JPEG or WebP up to 2 MB each, at most 12 per product.
        </p>
      </div>

      {localError ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {localError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
