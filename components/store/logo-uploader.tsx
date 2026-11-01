"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { cn } from "cn";

import { LOGO_CONSTRAINTS, validateImageUpload } from "@/lib/store/validation";

/**
 * Staged image picker for the settings form.
 *
 * Nothing uploads on select: the file is held in form state, previewed from
 * an object URL, and uploaded by the save action. Removing a current image
 * only stages a removal flag — the file disappears when the owner saves.
 */

export type StagedImage = {
  /** Currently stored public URL (null when none). */
  currentUrl: string | null;
  /** Newly picked file waiting to be saved. */
  file: File | null;
  /** True when the current image should be deleted on save. */
  removed: boolean;
};

export function LogoUploader({
  name,
  removedName,
  label,
  hint,
  value,
  onChange,
}: {
  /** FormData file key ("logo" / "favicon"). */
  name: string;
  /** FormData removal-flag key ("logoRemoved" / "faviconRemoved"). */
  removedName: string;
  label: string;
  hint: string;
  value: StagedImage;
  onChange: (value: StagedImage) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const previewUrl = value.file ? URL.createObjectURL(value.file) : value.currentUrl;
  const showCurrent = !value.file && value.currentUrl && !value.removed;

  async function pick(file: File | undefined) {
    setLocalError(null);
    if (!file) return;
    const checked = await validateImageUpload(file);
    if (!checked.ok) {
      setLocalError(checked.error);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    onChange({ currentUrl: value.currentUrl, file, removed: false });
  }

  function remove() {
    if (fileRef.current) fileRef.current.value = "";
    onChange({ currentUrl: value.currentUrl, file: null, removed: true });
  }

  function restore() {
    onChange({ currentUrl: value.currentUrl, file: null, removed: false });
  }

  return (
    <div className="grid gap-2">
      <span className="text-[0.8125rem] font-medium">{label}</span>

      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted/40",
            !previewUrl || value.removed ? "text-muted-foreground" : undefined,
          )}
        >
          {previewUrl && !value.removed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-6" />
          )}
        </span>

        <div className="grid gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex h-10 w-fit cursor-pointer items-center rounded-xl bg-secondary px-3.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            {showCurrent ? "Replace image" : "Choose image"}
          </label>
          {showCurrent || value.file ? (
            <button
              type="button"
              onClick={value.file ? restore : remove}
              className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
              {value.file ? "Discard new image" : "Remove image"}
            </button>
          ) : value.removed ? (
            <button
              type="button"
              onClick={restore}
              className="inline-flex h-9 w-fit items-center rounded-xl px-3 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Undo remove
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        id={inputId}
        name={name}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={(event) => void pick(event.currentTarget.files?.[0])}
      />
      <input type="hidden" name={removedName} value={value.removed && !value.file ? "1" : "0"} />

      {value.file ? (
        <p className="text-xs text-muted-foreground">
          New image staged — it uploads when you save.
        </p>
      ) : null}
      {value.removed ? (
        <p className="text-xs text-muted-foreground">Removal staged — applies when you save.</p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {hint} PNG, JPEG or WebP, up to {LOGO_CONSTRAINTS.maxBytes / 1024 / 1024} MB.
      </p>
      {localError ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
