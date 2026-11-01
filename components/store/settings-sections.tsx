"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

/**
 * Contextual navigation + section primitives for the Store Settings
 * workspace.
 *
 * This is page-local navigation only: the global admin sidebar remains the
 * primary application navigation. On desktop the index renders as a sticky
 * rail beside the content; on mobile it collapses to a horizontal chip row.
 * The active entry follows the viewport via IntersectionObserver
 * (scroll-spy), so owners always know which group they are editing.
 */

export const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "contact", label: "Contact & Location" },
  { id: "operations", label: "Operations" },
  { id: "storefront", label: "Storefront" },
  { id: "social", label: "Social" },
  { id: "regional", label: "Regional" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export function sectionAnchor(id: SettingsSectionId): string {
  return `settings-${id}`;
}

export function useActiveSettingsSection(): SettingsSectionId {
  const [active, setActive] = useState<SettingsSectionId>("general");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace(/^settings-/, "") as SettingsSectionId;
            if (SETTINGS_SECTIONS.some((section) => section.id === id)) setActive(id);
          }
        }
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    for (const section of SETTINGS_SECTIONS) {
      const element = document.getElementById(sectionAnchor(section.id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

export function SettingsNav() {
  const active = useActiveSettingsSection();

  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-16 z-20 border-b border-border/60 bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl"
    >
      <ul className="mx-auto flex w-full max-w-5xl gap-2 overflow-x-auto px-5 py-2 sm:px-8">
        {SETTINGS_SECTIONS.map((section) => {
          const selected = active === section.id;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${sectionAnchor(section.id)}`}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary/50 bg-primary/[0.08] font-semibold text-foreground"
                    : "border-border bg-card/60 font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * One settings group: an h2 landmark plus a single container whose inner
 * groups are separated by dividers — not a stack of identical cards.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: SettingsSectionId;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const headingId = `${sectionAnchor(id)}-title`;
  return (
    <section id={sectionAnchor(id)} aria-labelledby={headingId} className="scroll-mt-36">
      <div className="grid gap-1.5">
        <h2 id={headingId} className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="mt-4 divide-y divide-border/70 rounded-2xl border border-border bg-card/60">
        {children}
      </div>
    </section>
  );
}

/** Sub-group inside a section container. */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 p-4 sm:p-5">
      <div className="grid gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}
