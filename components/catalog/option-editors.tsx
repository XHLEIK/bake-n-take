"use client";

import { Plus, Trash2 } from "lucide-react";

import { FormField } from "@/components/auth/form-field";

/**
 * Dynamic row editors for variants and flavours.
 *
 * Rows live in parent state (with stable ids for saved rows so the server can
 * diff); the parent serializes them into hidden JSON inputs. Display order is
 * the array order — no separate order field to get out of sync.
 */

export type VariantDraft = {
  key: string;
  id: string | null;
  label: string;
  value: string;
  priceRupees: string;
  isActive: boolean;
};

export type FlavourDraft = {
  key: string;
  id: string | null;
  name: string;
  surchargeRupees: string;
  isActive: boolean;
};

export function newVariantRow(): VariantDraft {
  return {
    key: crypto.randomUUID(),
    id: null,
    label: "",
    value: "",
    priceRupees: "",
    isActive: true,
  };
}

export function newFlavourRow(): FlavourDraft {
  return { key: crypto.randomUUID(), id: null, name: "", surchargeRupees: "", isActive: true };
}

export function VariantRows({
  rows,
  onChange,
  error,
}: {
  rows: VariantDraft[];
  onChange: (rows: VariantDraft[]) => void;
  error?: string;
}) {
  function patch(index: number, patch: Partial<VariantDraft>) {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="grid gap-3">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="grid gap-3 rounded-xl border border-border p-3.5 sm:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <FormField
            label={`Option ${index + 1} label`}
            name={`variant-${index}-label`}
            placeholder="e.g. 1 Pound"
            maxLength={60}
            value={row.label}
            onChange={(event) => patch(index, { label: event.currentTarget.value })}
          />
          <FormField
            label="Value (optional)"
            name={`variant-${index}-value`}
            placeholder="e.g. 500g"
            maxLength={60}
            value={row.value}
            onChange={(event) => patch(index, { value: event.currentTarget.value })}
          />
          <FormField
            label="Price ₹"
            name={`variant-${index}-price`}
            inputMode="decimal"
            placeholder="600"
            value={row.priceRupees}
            onChange={(event) => patch(index, { priceRupees: event.currentTarget.value })}
          />
          <div className="flex items-end gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={row.isActive}
              aria-label={`Option ${index + 1} active`}
              onClick={() => patch(index, { isActive: !row.isActive })}
              className={`relative h-7 w-12 shrink-0 self-center rounded-full transition-colors sm:mb-2 ${
                row.isActive ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-1 left-1 size-5 rounded-full bg-card shadow transition-transform ${
                  row.isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, position) => position !== index))}
              aria-label={`Remove option ${index + 1}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl text-destructive hover:bg-destructive/10"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {rows.length < 40 ? (
        <button
          type="button"
          onClick={() => onChange([...rows, newVariantRow()])}
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add option
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FlavourRows({
  rows,
  onChange,
  error,
}: {
  rows: FlavourDraft[];
  onChange: (rows: FlavourDraft[]) => void;
  error?: string;
}) {
  function patch(index: number, patch: Partial<FlavourDraft>) {
    onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="grid gap-3">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="grid gap-3 rounded-xl border border-border p-3.5 sm:grid-cols-[2fr_1fr_auto]"
        >
          <FormField
            label={`Flavour ${index + 1}`}
            name={`flavour-${index}-name`}
            placeholder="e.g. Ferrero"
            maxLength={60}
            value={row.name}
            onChange={(event) => patch(index, { name: event.currentTarget.value })}
          />
          <FormField
            label="Extra charge ₹"
            name={`flavour-${index}-surcharge`}
            inputMode="decimal"
            placeholder="0"
            value={row.surchargeRupees}
            onChange={(event) => patch(index, { surchargeRupees: event.currentTarget.value })}
          />
          <div className="flex items-end gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={row.isActive}
              aria-label={`Flavour ${index + 1} active`}
              onClick={() => patch(index, { isActive: !row.isActive })}
              className={`relative h-7 w-12 shrink-0 self-center rounded-full transition-colors sm:mb-2 ${
                row.isActive ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-1 left-1 size-5 rounded-full bg-card shadow transition-transform ${
                  row.isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, position) => position !== index))}
              aria-label={`Remove flavour ${index + 1}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl text-destructive hover:bg-destructive/10"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {rows.length < 40 ? (
        <button
          type="button"
          onClick={() => onChange([...rows, newFlavourRow()])}
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add flavour
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
