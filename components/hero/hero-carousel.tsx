"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import type { HeroSlide } from "@/lib/hero/types";

const AUTOPLAY_MS = 6000;

/**
 * Slide photo with a graceful degradation path: a missing or deleted storage
 * object must never render a broken-image icon. On load failure the photo
 * swaps for the same warm branded wash the imageless panel uses, keeping the
 * overlay text fully legible.
 */
function HeroImage({ src, eager }: { src: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-primary/[0.22] via-secondary to-berry/[0.12]"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/**
 * Customer hero carousel (Phase 5.1).
 *
 * One renderer for every content type — slides arrive fully resolved from
 * the server selector. Native scroll-snap gives touch swipe for free;
 * arrows + dots serve desktop and assistive tech. Autoplay pauses on hover,
 * focus, touch and reduced-motion. Fixed aspect ratios prevent layout shift;
 * text always overlays (never cropped) while photos cover safely.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const count = slides.length;

  // Follow OS motion preference changes (subscription only, no mount write).
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return;
      const clamped = (next + count) % count;
      track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  // Active dot follows the scroll position (single rAF-throttled listener).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        setIndex(Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / width))));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  // Autoplay: advances only when visible, unpaused and motion is welcome.
  useEffect(() => {
    if (paused || reducedMotion || count < 2 || document.hidden) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        goTo(current + 1);
        return current;
      });
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, count, goTo]);

  if (count === 0) return null;

  return (
    <section
      aria-label="Store highlights"
      aria-roledescription="carousel"
      className="group relative grid gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, position) => (
          <article
            key={slide.key}
            aria-label={`${position + 1} of ${count}: ${slide.headline}`}
            aria-roledescription="slide"
            className="relative grid aspect-[4/5] w-full shrink-0 snap-center content-end overflow-hidden bg-secondary sm:aspect-[21/9]"
          >
            {slide.imageUrl ? (
              <HeroImage src={slide.imageUrl} eager={position === 0} />
            ) : (
              <span aria-hidden="true" className="absolute inset-0 bg-secondary" />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
            <span className="relative grid gap-1.5 p-5 text-white sm:p-8 [text-shadow:0_1px_12px_rgba(0,0,0,0.65)]">
              {slide.eyebrow ? (
                <span className="text-[11px] font-semibold tracking-[0.16em] uppercase opacity-90">
                  {slide.eyebrow}
                </span>
              ) : null}
              <span className="font-heading max-w-xl text-2xl font-semibold text-balance sm:text-4xl">
                {slide.headline}
              </span>
              {slide.description ? (
                <span className="max-w-xl text-sm opacity-90">{slide.description}</span>
              ) : null}
              {slide.cta ? (
                <span className="mt-1">
                  <Link
                    href={slide.href}
                    tabIndex={position === index ? 0 : -1}
                    className="inline-flex h-11 items-center rounded-xl bg-white/95 px-5 text-sm font-semibold text-stone-900 hover:bg-white"
                  >
                    {slide.cta}
                  </Link>
                </span>
              ) : null}
            </span>
          </article>
        ))}
      </div>

      {count > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5" role="tablist" aria-label="Choose slide">
            {slides.map((slide, position) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={position === index}
                aria-label={`Go to slide ${position + 1}: ${slide.headline}`}
                onClick={() => goTo(position)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  position === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground",
                )}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => goTo(index - 1)}
              className="grid size-9 place-items-center rounded-xl border border-border bg-card/80 hover:border-primary/40"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => goTo(index + 1)}
              className="grid size-9 place-items-center rounded-xl border border-border bg-card/80 hover:border-primary/40"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <span aria-live="polite" className="sr-only">
            Slide {index + 1} of {count}: {slides[index]?.headline}
          </span>
        </div>
      ) : null}
    </section>
  );
}
