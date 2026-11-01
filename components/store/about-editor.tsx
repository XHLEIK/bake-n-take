"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "cn";

import { FormField } from "@/components/auth/form-field";
import type { AboutBannerKey, AboutSettings } from "@/lib/store/types";

import { SettingsSwitch, SettingsTextArea } from "./fields";
import { LogoUploader, type StagedImage } from "./logo-uploader";

/**
 * About Us draft: the exact `aboutJson` document shape the server action
 * validates (snake_case, mirroring the stored jsonb). The custom banner
 * file travels separately through `LogoUploader` and its storage path is
 * merged server-side.
 */
export type AboutFormDraft = {
  enabled: boolean;
  eyebrow: string;
  heading: string;
  body: string;
  secondary: string;
  cta_label: string;
  cta_href: string;
  banner: AboutBannerKey;
};

export function toAboutDraft(about: AboutSettings): AboutFormDraft {
  return {
    enabled: about.enabled,
    eyebrow: about.eyebrow,
    heading: about.heading,
    body: about.body,
    secondary: about.secondary,
    cta_label: about.ctaLabel,
    cta_href: about.ctaHref,
    banner: about.banner,
  };
}

/**
 * Owner About Us editor (content only — the parent settings group owns the
 * surrounding container).
 *
 * Copy fields, a visibility switch, a default-banner picker over the real
 * seeded `banners/predefined-*` storage objects, and a custom upload with
 * live preview — all staged locally until the single form save. Nothing
 * here writes anything on its own.
 */
export function AboutEditor({
  draft,
  onChange,
  image,
  onImageChange,
  defaults,
  error,
}: {
  draft: AboutFormDraft;
  onChange: (next: AboutFormDraft) => void;
  image: StagedImage;
  onImageChange: (value: StagedImage) => void;
  defaults: { key: AboutBannerKey; label: string; url: string }[];
  error?: string;
}) {
  function set<K extends keyof AboutFormDraft>(key: K) {
    return (value: AboutFormDraft[K]) => onChange({ ...draft, [key]: value });
  }

  function setEnabled(enabled: boolean) {
    onChange({ ...draft, enabled });
  }

  // A staged file or a kept upload wins; otherwise the picked default.
  const hasCustom = image.file !== null || (!image.removed && image.currentUrl !== null);
  const effectiveLabel = hasCustom
    ? "Custom upload"
    : (defaults.find((entry) => entry.key === draft.banner)?.label ?? "Default banner");

  function resetToDefault() {
    onChange({ ...draft, banner: "bread" });
    onImageChange({ currentUrl: image.currentUrl, file: null, removed: image.currentUrl !== null });
  }

  return (
    <>
      <SettingsSwitch
        label="Show About Us section"
        description="Off hides the section from the homepage without deleting its content."
        name="aboutEnabled"
        checked={draft.enabled}
        onChange={setEnabled}
      />
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Eyebrow"
          name="aboutEyebrow"
          maxLength={60}
          value={draft.eyebrow}
          onChange={(event) => set("eyebrow")(event.currentTarget.value)}
        />
        <FormField
          label="CTA label"
          name="aboutCtaLabel"
          maxLength={40}
          value={draft.cta_label}
          onChange={(event) => set("cta_label")(event.currentTarget.value)}
        />
      </div>
      <FormField
        label="Heading"
        name="aboutHeading"
        maxLength={120}
        value={draft.heading}
        onChange={(event) => set("heading")(event.currentTarget.value)}
      />
      <SettingsTextArea
        label="Body"
        name="aboutBody"
        rows={4}
        maxLength={2000}
        value={draft.body}
        onChange={set("body")}
      />
      <SettingsTextArea
        label="Secondary line (optional)"
        name="aboutSecondary"
        rows={2}
        maxLength={500}
        hint="Leave empty to hide it."
        value={draft.secondary}
        onChange={set("secondary")}
      />
      <FormField
        label="Button link"
        name="aboutCtaHref"
        maxLength={500}
        hint="In-store path (/shop) or full https URL."
        value={draft.cta_href}
        onChange={(event) => set("cta_href")(event.currentTarget.value)}
      />

      <div className="grid gap-2">
        <span className="text-[0.8125rem] font-medium">Default banner</span>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          role="group"
          aria-label="Default banner"
        >
          {defaults.map((entry) => {
            const selected = !hasCustom && draft.banner === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...draft, banner: entry.key })}
                className={cn(
                  "group grid gap-1.5 rounded-xl border p-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary/60 bg-primary/[0.06]"
                    : "border-border/60 hover:border-primary/40",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.url}
                  alt=""
                  loading="lazy"
                  className="aspect-[16/10] w-full rounded-lg object-cover"
                />
                <span className="px-0.5 text-xs text-muted-foreground">{entry.label}</span>
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          Current banner: {effectiveLabel}.
        </p>
      </div>

      <LogoUploader
        name="aboutBanner"
        removedName="aboutBannerRemoved"
        label="Custom banner"
        hint="Replaces the default banner when saved."
        value={image}
        onChange={onImageChange}
      />
      {hasCustom ? (
        <button
          type="button"
          onClick={resetToDefault}
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset to default banner
        </button>
      ) : null}
    </>
  );
}
