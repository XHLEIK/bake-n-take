"use client";

import { useState } from "react";
import { ArrowUpRight, Layers } from "lucide-react";
import { cn } from "cn";

export type CategoryOption = {
  /** "all" for the full catalogue, otherwise the category slug. */
  key: string;
  label: string;
  count: number;
};

/**
 * Per-tile accent personalities, rotating deterministically by position.
 * Token-only (primary/berry/sage adapt to light and dark) — full static
 * class strings so the compiler always sees them.
 */
const TILE_ACCENTS = [
  {
    wash: "from-primary/[0.12]",
    glow: "bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]",
    initial: "text-primary/[0.18]",
  },
  {
    wash: "from-berry/[0.10]",
    glow: "bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--berry)_20%,transparent),transparent)]",
    initial: "text-berry/[0.16]",
  },
  {
    wash: "from-sage/[0.12]",
    glow: "bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--sage)_22%,transparent),transparent)]",
    initial: "text-sage/[0.18]",
  },
] as const;

/**
 * Inline category filter island (Home page).
 *
 * Real buttons with pressed states — never navigation. The panels arrive
 * pre-rendered from the server shell, so switching is instant local state:
 * no refetch, no page reload, no layout shift. The Bake List arrow lives in
 * the section header, so nothing here leaves the page. Entrance uses the
 * shared fade token, which the global stylesheet already collapses under
 * `prefers-reduced-motion`.
 */
export function CategoryFilter({
  options,
  panels,
}: {
  options: CategoryOption[];
  panels: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState("all");
  const current = options.some((option) => option.key === active) ? active : "all";

  return (
    <div className="grid gap-6">
      <div
        role="group"
        aria-label="Filter products by category"
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option, position) => (
          <CategoryTile
            key={option.key}
            option={option}
            index={position}
            selected={option.key === current}
            onSelect={() => setActive(option.key)}
          />
        ))}
      </div>

      <div key={current} className="animate-fade">
        {panels[current] ?? panels.all ?? null}
      </div>
    </div>
  );
}

function CategoryTile({
  option,
  index,
  selected,
  onSelect,
}: {
  option: CategoryOption;
  /** Zero-based position: drives the index label and accent rotation. */
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const isAll = option.key === "all";
  const accent = TILE_ACCENTS[index % TILE_ACCENTS.length];
  const initial = option.label.trim().slice(0, 1).toUpperCase() || "•";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative inline-flex min-h-11 shrink-0 snap-start cursor-pointer items-center gap-2 overflow-hidden rounded-full border px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:grid md:aspect-square md:w-auto md:rounded-2xl md:p-5 md:text-left md:hover:-translate-y-1",
        isAll && "md:border-primary/50 md:bg-primary/[0.08]",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_-16px_rgb(66_40_16/0.6)] md:border-primary/70 md:bg-card/60 md:text-foreground md:shadow-[0_24px_48px_-24px_rgb(66_40_16/0.55)] md:hover:border-primary"
          : "border-border/70 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-[0.99] dark:shadow-none",
      )}
    >
      {/* Warm accent wash + soft light + grain: tile richness, desktop only. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 hidden bg-gradient-to-b to-transparent transition-opacity duration-300 md:block",
          accent.wash,
          selected ? "opacity-100" : "opacity-70 group-hover:opacity-100",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute -top-1/4 -right-1/4 hidden size-3/4 rounded-full blur-2xl transition-opacity duration-300 md:block",
          accent.glow,
          selected ? "opacity-100" : "opacity-50 group-hover:opacity-90",
        )}
      />
      <span
        aria-hidden="true"
        className="brand-grain absolute inset-0 hidden opacity-40 md:block"
      />
      {/* Oversized editorial initial behind the content, desktop only. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute -right-2 -bottom-8 hidden font-serif text-[6.5rem] leading-none italic select-none md:block",
          accent.initial,
        )}
      >
        {initial}
      </span>

      <span className="relative flex items-center gap-1.5 md:h-full md:flex-col md:items-stretch md:justify-between md:gap-2">
        <span className="hidden items-start justify-between gap-2 md:flex">
          <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          {isAll ? (
            <Layers
              aria-hidden="true"
              className={cn(
                "size-4 transition-colors duration-300",
                selected ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary",
              )}
            />
          ) : (
            <ArrowUpRight
              aria-hidden="true"
              className={cn(
                "size-4 transition-all duration-300",
                selected
                  ? "text-primary"
                  : "-translate-x-0.5 translate-y-0.5 opacity-0 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-primary group-hover:opacity-100",
              )}
            />
          )}
        </span>
        <span className="flex items-baseline gap-1.5 md:grid md:gap-1">
          <span
            className={cn(
              "font-heading text-sm font-semibold tracking-tight text-balance md:text-lg md:leading-snug",
              selected && "md:text-primary",
            )}
          >
            {option.label}
          </span>
          <span
            className={cn(
              "hidden text-xs whitespace-nowrap md:block",
              selected
                ? "text-primary-foreground/80 md:text-muted-foreground"
                : "text-muted-foreground",
            )}
          >
            {isAll
              ? "Everything from the counter"
              : option.count === 0
                ? "Coming soon"
                : `${option.count} bake${option.count === 1 ? "" : "s"}`}
          </span>
        </span>
      </span>
    </button>
  );
}
