import { MailPlus } from "lucide-react";

import { NewsletterForm } from "./newsletter-form";

/**
 * Homepage newsletter section (Phase 6).
 *
 * "Join our family": new bakes and quiet offers by email. Pure server shell
 * around the subscribe form island — no fake subscriptions, every state
 * (idle, pending, invalid, duplicate, saved, failed) is real.
 */
export function NewsletterSection() {
  return (
    <section
      aria-label="Newsletter"
      className="relative grid gap-6 overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 p-7 shadow-[0_24px_60px_-40px_rgb(120_72_20/0.35)] sm:p-10 dark:shadow-none"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_12%,transparent),transparent)]"
      />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="grid content-start gap-3">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.16em] text-primary uppercase">
            <MailPlus aria-hidden="true" className="size-3.5" />
            Join our family
          </p>
          <h2 className="font-serif text-3xl leading-[1.1] font-medium tracking-[-0.01em] text-balance sm:text-4xl">
            Fresh news, first slice.
          </h2>
          <p className="max-w-[42ch] text-sm leading-relaxed text-pretty text-muted-foreground">
            New bakes, seasonal specials and quiet offers — straight to your inbox. No noise,
            unsubscribe anytime.
          </p>
        </div>
        <NewsletterForm />
      </div>
    </section>
  );
}
