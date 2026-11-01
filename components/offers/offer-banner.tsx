import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";

import type { BannerStyle } from "@/lib/promotions/types";

/**
 * Offer banner card (Phase 5).
 *
 * One presentational component for the owner preview and the customer hero:
 * either the uploaded image or one of the predefined gradient styles. The
 * optional href is always an allow-listed same-app destination.
 */

const STYLE_GRADIENTS: Record<BannerStyle, string> = {
  ember: "from-orange-600 via-rose-600 to-amber-500",
  honey: "from-amber-500 via-yellow-500 to-orange-400",
  cocoa: "from-amber-900 via-yellow-900 to-amber-700",
  berry: "from-fuchsia-700 via-purple-700 to-indigo-600",
  matcha: "from-lime-600 via-emerald-600 to-teal-600",
  ocean: "from-sky-600 via-cyan-600 to-teal-500",
};

export function OfferBanner({
  header,
  title,
  description,
  ctaLabel,
  style,
  imageUrl,
  href,
}: {
  header: string | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  style: BannerStyle;
  imageUrl: string | null;
  href?: string;
}) {
  const body = (
    <span
      className={cn(
        "relative grid gap-1.5 overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white",
        STYLE_GRADIENTS[style] ?? STYLE_GRADIENTS.ember,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <span
        className={cn(
          "relative grid gap-1.5",
          imageUrl ? "rounded-xl bg-black/45 p-3 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]" : null,
        )}
      >
        {header ? (
          <span className="text-[11px] font-semibold tracking-[0.16em] uppercase opacity-90">
            {header}
          </span>
        ) : null}
        <span className="font-heading text-xl font-semibold text-balance">
          {title || "Untitled offer"}
        </span>
        {description ? <span className="max-w-md text-sm opacity-90">{description}</span> : null}
        {ctaLabel ? (
          <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
            {ctaLabel}
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block transition-transform hover:scale-[1.01]">
      {body}
    </Link>
  );
}
