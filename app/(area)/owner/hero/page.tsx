import type { Metadata } from "next";
import Link from "next/link";

import { OfferStatusBadge } from "@/components/offers/offer-status-badge";
import { HeroRowActions } from "@/components/hero/hero-row-actions";
import { requireOwner } from "@/lib/auth/session";
import { listOwnerHeroItems } from "@/lib/hero/repository";
import { EFFECTIVE_STATUS_LABELS } from "@/lib/promotions/status";
import { HERO_TYPES } from "@/lib/hero/types";

export const metadata: Metadata = { title: "Hero Carousel" };

type Search = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Owner hero dashboard (Phase 5.1).
 *
 * Every slide row shows type, title/source, effective status, window,
 * priority/order, destination and quick actions. New slides start as drafts;
 * system slides expose enable/disable and reorder only.
 */
export default async function OwnerHeroPage({ searchParams }: { searchParams: Search }) {
  await requireOwner("/owner/hero");
  const params = await searchParams;

  const sortParam = first(params.sort);
  const rows = await listOwnerHeroItems({
    search: first(params.q) || undefined,
    status: first(params.status) || undefined,
    type: first(params.type) || undefined,
    sort: sortParam === "oldest" ? "oldest" : sortParam === "ordered" ? "ordered" : "newest",
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
            Owner console
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Hero Carousel
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} slide{rows.length === 1 ? "" : "s"} · customers see the top slides in tier
            order
          </p>
        </div>
        <Link
          href="/owner/hero/new"
          className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New slide
        </Link>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="grid gap-1.5 text-xs font-medium">
          Search
          <input
            name="q"
            defaultValue={first(params.q)}
            placeholder="Title or source…"
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm font-normal"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Status
          <select
            name="status"
            defaultValue={first(params.status)}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
          >
            <option value="">All</option>
            {Object.entries(EFFECTIVE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Type
          <select
            name="type"
            defaultValue={first(params.type)}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
          >
            <option value="">All</option>
            {HERO_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          Sort
          <select
            name="sort"
            defaultValue={sortParam || "ordered"}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
          >
            <option value="ordered">Manual order</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-10 w-full rounded-xl bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Apply
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="grid gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <p className="font-medium">No slides match.</p>
          <p className="text-sm text-muted-foreground">
            Feature an offer, product or category — or let the system defaults carry the homepage.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map(({ item, effective, sourceName }) => (
            <li
              key={item.id}
              className="grid gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {item.isSystem ? (
                  <span className="font-medium">
                    {item.title ?? item.systemKey?.replace("_", " ") ?? "System slide"}
                  </span>
                ) : (
                  <Link href={`/owner/hero/${item.id}`} className="font-medium hover:underline">
                    {item.title ?? sourceName ?? item.type}
                  </Link>
                )}
                <OfferStatusBadge status={effective} />
              </div>
              <p className="text-xs text-muted-foreground">
                {item.type}
                {sourceName && !item.title ? ` · ${sourceName}` : ""}
                {sourceName && item.title ? ` · ${sourceName}` : ""} · order {item.displayOrder} ·
                priority {item.priority}
                {item.startsAt || item.endsAt ? (
                  <>
                    {" · "}
                    {item.startsAt
                      ? new Date(item.startsAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "…"}
                    {" → "}
                    {item.endsAt
                      ? new Date(item.endsAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "no end"}
                  </>
                ) : null}
              </p>
              <HeroRowActions
                heroId={item.id}
                effective={effective}
                baseStatus={item.status}
                isSystem={item.isSystem}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
