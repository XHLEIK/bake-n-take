import Image from "next/image";
import { Croissant } from "lucide-react";
import { cn } from "cn";

import { storeAssetUrl } from "@/lib/store/repository";
import type { StoreSettings } from "@/lib/store/types";

/**
 * Brand mark driven by store settings (Phase 2).
 *
 * The uploaded logo renders when configured; otherwise a neutral icon tile
 * stands in — never a hardcoded name baked into the component. The wordmark
 * is always the store name from settings, with the tagline as a slogan
 * beneath it where requested. On the extra-large auth lockup the slogan is
 * the owner's name, so it renders with the built-in "By" prefix ("By Sudipta"
 * for a tagline of "Sudipta") — the prefix lives in presentation only and is
 * never stored in the database. An empty tagline renders nothing (never a
 * lone "By"). Missing settings render neutrally (tile, no
 * name), so a rename propagates without touching code.
 *
 * Sizes: `md` for bars and footers, `lg` for feature moments, `xl` for the
 * auth hero lockup — where the logo tile, the serif wordmark and the slogan
 * all step up so branding carries the same weight as the statement type.
 * Direction (row vs stacked) is decided by the caller via className.
 */
export function BrandMark({
  settings,
  slogan = false,
  size = "md",
  className,
}: {
  settings: StoreSettings | null;
  /** Show the tagline as a slogan under the shop name. */
  slogan?: boolean;
  /** Compact (bars, footers), large (feature) or extra-large (auth hero). */
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const name = settings?.storeName ?? null;
  const logoUrl = storeAssetUrl(settings?.logoPath ?? null);
  const serif = size === "xl" || size === "lg";
  const tileSize =
    size === "xl"
      ? "size-[4.5rem] rounded-[1.5rem] lg:size-[5.5rem] lg:rounded-[2rem]"
      : size === "lg"
        ? "size-12 rounded-2xl"
        : "size-9 rounded-xl";
  const iconSize = size === "xl" ? "size-9 lg:size-10" : size === "lg" ? "size-6" : "size-5";
  const nameSize =
    size === "xl"
      ? "font-serif text-[1.875rem] leading-[1.05] lg:text-[2.375rem]"
      : size === "lg"
        ? "font-serif text-xl"
        : "text-base";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        size === "lg" && "gap-3",
        size === "xl" && "gap-4",
        className,
      )}
    >
      {logoUrl ? (
        <span
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden bg-card shadow-[0_18px_36px_-18px_rgb(66_40_16/0.45)] ring-1 ring-border/60",
            tileSize,
          )}
        >
          <Image src={logoUrl} alt="" fill sizes="112px" className="object-contain" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "brand-surface grid shrink-0 place-items-center text-primary-foreground",
            tileSize,
          )}
        >
          <Croissant aria-hidden="true" className={iconSize} />
        </span>
      )}
      <span className="grid min-w-0 leading-tight">
        {name ? (
          <span
            className={cn(
              "truncate font-semibold tracking-tight text-foreground",
              nameSize,
              serif && "tracking-[-0.01em]",
              !serif && "font-heading",
            )}
          >
            {name}
          </span>
        ) : (
          <span className="sr-only">Store</span>
        )}
        {slogan && settings?.tagline ? (
          size === "xl" ? (
            <span className="mt-0.5 font-serif text-[1rem] leading-snug text-primary/90 italic lg:text-[1.125rem]">
              By {settings.tagline}
            </span>
          ) : (
            <span className="max-w-[180px] truncate text-[11px] text-muted-foreground sm:max-w-xs">
              {settings.tagline}
            </span>
          )
        ) : null}
      </span>
    </span>
  );
}
