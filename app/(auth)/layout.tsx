import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggleHost } from "@/components/site/theme-toggle-host";
import { getStoreSettings } from "@/lib/store/repository";

/**
 * Authentication shell.
 *
 * Desktop is a premium split: a tall brand statement on the left, the form
 * in a frosted panel on the right. The whole composition fits one viewport
 * with no scrolling - all vertical rhythm is driven by the height-aware
 * `--auth-*` variables defined in globals.css, so the same markup composes
 * itself from short laptops to tall monitors. The form column keeps an
 * overflow safety net that never shows a scrollbar at real desktop sizes.
 *
 * Below `lg` it collapses to a single centered column that scrolls naturally,
 * with a compact centered lockup standing in for the brand panel.
 *
 * Branding is store-settings driven, never hardcoded: the lockup shows the
 * store name with "By [tagline]" (the owner's name) and the statement renders
 * the description, falling back to the static line when empty.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStoreSettings();
  const name = settings?.storeName ?? null;
  const tagline = settings?.tagline ?? null;
  // Dynamic hero statement from Store Settings → Description. Null falls back
  // to the original static statement below, so an empty description never
  // renders an empty hero section.
  const heroStatement = settings?.description?.trim() ? settings.description : null;

  return (
    <div
      data-auth-shell
      className="relative flex min-h-dvh flex-col overflow-x-clip lg:grid lg:h-dvh lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden"
    >
      {/* Ambient canvas: grain + aurora washes + a soft top light. */}
      <div
        aria-hidden="true"
        className="brand-grain pointer-events-none fixed inset-0 z-0 opacity-40 mix-blend-soft-light"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <span className="aurora-wash animate-[drift-a_34s_ease-in-out_infinite] -top-40 -left-32 size-[44rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_17%,transparent),transparent_72%)]" />
        <span className="aurora-wash animate-[drift-b_42s_ease-in-out_infinite] top-1/4 -right-48 size-[40rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--berry)_13%,transparent),transparent_70%)] dark:bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--berry)_17%,transparent),transparent_70%)]" />
        <span className="aurora-wash animate-[drift-c_28s_ease-in-out_infinite] -bottom-52 left-1/4 size-[36rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--sage)_10%,transparent),transparent_70%)] dark:bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--sage)_14%,transparent),transparent_70%)]" />
      </div>

      {/* Theme control pinned to the true top-right corner on every breakpoint. */}
      <div className="absolute top-4 right-4 z-20 sm:top-5 sm:right-6">
        <ThemeToggleHost className="rounded-2xl border border-border/50 bg-card/50 shadow-[0_8px_20px_-12px_rgb(78_48_20/0.25)] backdrop-blur-md dark:border-white/10" />
      </div>

      {/* ---------------------------------------------------- brand panel -- */}
      <aside className="relative z-10 hidden flex-col justify-center gap-8 border-r border-border/40 bg-gradient-to-b from-primary/[0.07] via-transparent to-berry/[0.06] p-8 xl:gap-10 xl:p-14 2xl:p-16 lg:flex dark:border-white/5">
        <Link
          href="/"
          aria-label={name ? `${name} home` : "Store home"}
          className="group w-fit rounded-3xl"
        >
          <BrandMark
            settings={settings}
            slogan
            size="xl"
            className="gap-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
          />
        </Link>

        <div className="grid justify-items-start gap-6">
          {heroStatement ? (
            <p className="font-serif text-[clamp(2.5rem,4.2vw,3.5rem)] leading-[1.08] font-medium tracking-[-0.015em] text-balance whitespace-pre-line xl:leading-[1.06]">
              {heroStatement}
            </p>
          ) : (
            <p className="font-serif text-[clamp(2.5rem,4.2vw,3.5rem)] leading-[1.08] font-medium tracking-[-0.015em] text-balance xl:leading-[1.06]">
              Baked at dawn,
              <br />
              <span className="text-primary italic">boxed to go</span> by noon.
            </p>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------ form panel -- */}
      <main
        data-auth-scroll
        className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:px-8 lg:mx-0 lg:h-auto lg:w-full lg:max-w-none lg:overflow-y-auto lg:overscroll-contain lg:px-10 lg:py-[var(--auth-shell-pad-y,2rem)] xl:px-14"
      >
        {/* Compact lockup: mobile/tablet only (the aside owns desktop). */}
        <div className="animate-rise mb-6 grid justify-items-center gap-3 text-center lg:hidden">
          <Link
            href="/"
            className="rounded-[1.75rem]"
            aria-label={name ? `${name} home` : "Store home"}
          >
            <BrandMark
              settings={settings}
              size="xl"
              className="inline-flex flex-col items-center gap-3"
            />
          </Link>
          {tagline ? <p className="text-sm text-muted-foreground">By {tagline}</p> : null}
        </div>

        <div className="m-auto grid w-full gap-6 sm:gap-8 lg:max-w-[30rem] lg:gap-[var(--auth-gap,1.25rem)]">
          <div className="animate-rise [animation-delay:90ms]">{children}</div>
        </div>
      </main>
    </div>
  );
}
