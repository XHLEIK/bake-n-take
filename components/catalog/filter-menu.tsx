"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "cn";

export type FilterMenuLink = {
  href: string;
  label: string;
  active: boolean;
};

/**
 * Generic shop filter dropdown (isolated client island).
 *
 * Designed as one cell of a segmented control row: the trigger stretches
 * to its cell and the panel stretches exactly to the trigger (`left-0
 * right-0`), so panels can never be wider than their button or escape the
 * viewport at any breakpoint. Links stay plain server-rendered links, so
 * the URL remains the source of truth and selecting an option navigates.
 * This island owns just the open state: selecting a row closes immediately,
 * opening one menu closes any other via a window event, Escape closes and
 * refocuses the trigger, outside taps close, and nothing scrolls the page.
 */
const MENU_OPEN_EVENT = "bnt:filter-menu-open";

export function FilterMenu({
  label,
  icon,
  sections,
  active = false,
}: {
  /** Pill content: the section name, the current value, or both. */
  label: ReactNode;
  icon: ReactNode;
  sections: { heading: string; links: FilterMenuLink[] }[];
  /** A non-default option is applied — tint the trigger, not just the row. */
  active?: boolean;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: menuId }));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onOtherMenu(event: Event) {
      if ((event as CustomEvent).detail !== menuId) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener(MENU_OPEN_EVENT, onOtherMenu);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener(MENU_OPEN_EVENT, onOtherMenu);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, menuId]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn(
          "inline-flex h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-1.5 sm:px-3 sm:text-sm",
          open || active
            ? "bg-primary/[0.08] text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
        )}
      >
        <span aria-hidden="true" className="grid shrink-0 place-items-center [&_svg]:size-4">
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200 sm:size-4",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 grid max-h-[60dvh] gap-1 overflow-y-auto rounded-2xl border border-border/70 bg-popover p-2 shadow-[0_24px_48px_-24px_rgb(66_40_16/0.45)] animate-fade dark:border-white/10 dark:shadow-none">
          {sections.map((section) => (
            <div key={section.heading} className="grid min-w-0 gap-1">
              <p className="truncate px-3 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {section.heading}
              </p>
              {section.links.map((link) => (
                <FilterRow key={link.href} link={link} onSelect={() => setOpen(false)} />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterRow({ link, onSelect }: { link: FilterMenuLink; onSelect: () => void }) {
  return (
    <Link
      href={link.href}
      scroll={false}
      onClick={onSelect}
      aria-current={link.active ? "true" : undefined}
      className={cn(
        "flex h-11 min-w-0 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors",
        link.active
          ? "bg-primary/[0.08] font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center",
          link.active ? "text-primary" : "text-transparent",
        )}
      >
        <Check className="size-4" />
      </span>
      <span className="truncate">{link.label}</span>
    </Link>
  );
}
