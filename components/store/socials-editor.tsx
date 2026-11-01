"use client";

import { Link2, Plus, Trash2 } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import type { SocialLinks } from "@/lib/store/types";

/**
 * Fixed fields for the three core platforms plus owner-defined extras, so new
 * networks never need a schema or UI migration. Empty URLs are dropped on
 * save; icons only render for configured URLs.
 */
export type SocialsDraft = {
  instagram: string;
  facebook: string;
  whatsapp: string;
  extra: { label: string; url: string }[];
};

export function socialsToDraft(socials: SocialLinks): SocialsDraft {
  return {
    instagram: socials.instagram ?? "",
    facebook: socials.facebook ?? "",
    whatsapp: socials.whatsapp ?? "",
    extra: socials.extra?.map((entry) => ({ ...entry })) ?? [],
  };
}

export function SocialsEditor({
  value,
  onChange,
  errors,
}: {
  value: SocialsDraft;
  onChange: (value: SocialsDraft) => void;
  errors?: Partial<Record<string, string>>;
}) {
  function setExtra(index: number, patch: Partial<{ label: string; url: string }>) {
    onChange({
      ...value,
      extra: value.extra.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry,
      ),
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Instagram URL"
          name="social-instagram"
          type="url"
          inputMode="url"
          placeholder="https://instagram.com/…"
          icon={<Link2 className="size-4" />}
          value={value.instagram}
          onChange={(event) => onChange({ ...value, instagram: event.currentTarget.value })}
          error={errors?.["socialsJson.instagram"]}
        />
        <FormField
          label="Facebook URL"
          name="social-facebook"
          type="url"
          inputMode="url"
          placeholder="https://facebook.com/…"
          icon={<Link2 className="size-4" />}
          value={value.facebook}
          onChange={(event) => onChange({ ...value, facebook: event.currentTarget.value })}
          error={errors?.["socialsJson.facebook"]}
        />
      </div>

      <FormField
        label="WhatsApp link"
        name="social-whatsapp"
        type="url"
        inputMode="url"
        placeholder="https://wa.me/…"
        hint="A wa.me link opens a chat; a plain number belongs in Contact instead."
        icon={<Link2 className="size-4" />}
        value={value.whatsapp}
        onChange={(event) => onChange({ ...value, whatsapp: event.currentTarget.value })}
        error={errors?.["socialsJson.whatsapp"]}
      />

      {value.extra.map((entry, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-xl border border-border p-3.5 sm:grid-cols-[1fr_2fr_auto]"
        >
          <FormField
            label="Platform name"
            name={`social-extra-${index}-label`}
            placeholder="YouTube"
            maxLength={30}
            value={entry.label}
            onChange={(event) => setExtra(index, { label: event.currentTarget.value })}
            error={errors?.[`socialsJson.extra.${index}.label`]}
          />
          <FormField
            label="Profile URL"
            name={`social-extra-${index}-url`}
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={entry.url}
            onChange={(event) => setExtra(index, { url: event.currentTarget.value })}
            error={errors?.[`socialsJson.extra.${index}.url`]}
          />
          <button
            type="button"
            onClick={() => onChange({ ...value, extra: value.extra.filter((_, i) => i !== index) })}
            aria-label={`Remove ${entry.label || "extra link"}`}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-medium text-destructive self-end hover:bg-destructive/10"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Remove
          </button>
        </div>
      ))}

      {value.extra.length < 6 ? (
        <button
          type="button"
          onClick={() => onChange({ ...value, extra: [...value.extra, { label: "", url: "" }] })}
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add another platform
        </button>
      ) : null}

      {errors?.socialsJson ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {errors.socialsJson}
        </p>
      ) : null}
    </div>
  );
}
