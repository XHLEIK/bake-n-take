import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { storeAssetUrl } from "@/lib/store/repository";
import { aboutBannerPath, resolveAboutCtaHref, type StoreSettings } from "@/lib/store/types";

import { AboutBanner } from "./about-banner";

/**
 * Homepage About Us section (Phase 7).
 *
 * Pure server component around one tiny client image island. Content is
 * fully owner-editable through Store Settings → About Us, falling back to
 * compiled defaults for existing stores — never invented per-render.
 * Renders nothing when the owner disables the section. The `scroll-mt`
 * keeps the heading clear of the sticky header on anchor navigation.
 */
export function AboutSection({
  settings,
  webstore,
}: {
  settings: StoreSettings | null;
  webstore: string;
}) {
  const about = settings?.about;
  if (!about?.enabled) return null;

  const bannerSrc = storeAssetUrl(about.bannerPath ?? aboutBannerPath(about.banner));
  const fallbackSrc = storeAssetUrl(aboutBannerPath("bread"));
  if (!bannerSrc || !fallbackSrc) return null;

  return (
    <div className="surface-about">
      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <section
          aria-label="About us"
          id="about"
          className="grid scroll-mt-24 items-center gap-8 lg:grid-cols-2 lg:gap-14"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border/60 shadow-[0_24px_48px_-32px_rgb(66_40_16/0.45)] dark:border-white/10 dark:shadow-none">
            <AboutBanner
              src={bannerSrc}
              fallbackSrc={fallbackSrc}
              alt={`${settings?.storeName ?? "Bakery"} — our bakes`}
            />
          </div>
          <div className="grid content-start gap-4">
            <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-primary/90 uppercase">
              {about.eyebrow}
            </p>
            <h2 className="font-serif text-3xl leading-[1.1] font-medium tracking-[-0.01em] text-balance sm:text-4xl lg:text-[2.75rem]">
              {about.heading}
            </h2>
            <p className="max-w-[52ch] text-base leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
              {about.body}
            </p>
            {about.secondary.trim() ? (
              <p className="max-w-[52ch] text-sm leading-relaxed text-pretty text-muted-foreground">
                {about.secondary}
              </p>
            ) : null}
            <p className="mt-1">
              <Link
                href={resolveAboutCtaHref(webstore, about.ctaHref)}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
              >
                {about.ctaLabel}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
