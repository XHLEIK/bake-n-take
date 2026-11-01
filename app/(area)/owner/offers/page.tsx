import type { Metadata } from "next";
import Link from "next/link";

import { requireOwner } from "@/lib/auth/session";
import { listOwnerPromotions } from "@/lib/promotions/repository";
import { EFFECTIVE_STATUS_LABELS } from "@/lib/promotions/status";
import { OfferRowActions } from "@/components/offers/offer-row-actions";
import { OfferStatusBadge } from "@/components/offers/offer-status-badge";

export const metadata: Metadata = { title: "Offers" };

type Search = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Owner offers dashboard (Phase 5).
 *
 * Search by name, effective-status filter (scheduled/expired are derived, so
 * they appear here with zero owner intervention), priority/newest/oldest
 * sort. Cards link to the editor; quick actions sit below each card so form
 * submissions never nest inside a link.
 */
export default async function OwnerOffersPage({ searchParams }: { searchParams: Search }) {
  await requireOwner("/owner/offers");
  const params = await searchParams;

  const sortParam = first(params.sort);
  const offers = await listOwnerPromotions({
    search: first(params.q) || undefined,
    status: first(params.status) || undefined,
    sort: sortParam === "oldest" ? "oldest" : sortParam === "priority" ? "priority" : "newest",
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
            Owner console
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Offers</h1>
          <p className="text-sm text-muted-foreground">
            {offers.length} offer{offers.length === 1 ? "" : "s"} · discounts apply automatically at
            checkout
          </p>
        </div>
        <Link
          href="/owner/offers/new"
          className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New offer
        </Link>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="grid gap-1.5 text-xs font-medium">
          Search
          <input
            name="q"
            defaultValue={first(params.q)}
            placeholder="Offer name…"
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
          Sort
          <select
            name="sort"
            defaultValue={sortParam || "newest"}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="priority">Priority</option>
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

      {offers.length === 0 ? (
        <div className="grid gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <p className="font-medium">No offers match.</p>
          <p className="text-sm text-muted-foreground">
            Create your first offer — percentage off, buy-one-get-one, bundles, first-order treats
            or coupon codes.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {offers.map(({ promotion, effective, couponCount }) => (
            <li
              key={promotion.id}
              className="grid gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/owner/offers/${promotion.id}`}
                  className="font-medium hover:underline"
                >
                  {promotion.name}
                </Link>
                <OfferStatusBadge status={effective} />
              </div>
              <p className="text-xs text-muted-foreground">
                {promotion.type.replace(/_/g, " ")} · priority {promotion.priority}
                {promotion.isExclusive ? " · exclusive" : ""}
                {promotion.isStackable ? " · stackable" : ""}
                {promotion.autoApply ? "" : " · coupon only"} · used {promotion.usesCount}
                {promotion.maxUsesGlobal ? `/${promotion.maxUsesGlobal}` : ""} times
                {couponCount > 0 ? ` · ${couponCount} code${couponCount === 1 ? "" : "s"}` : ""}
                {promotion.startsAt || promotion.endsAt ? (
                  <>
                    {" · "}
                    {promotion.startsAt
                      ? new Date(promotion.startsAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "…"}
                    {" → "}
                    {promotion.endsAt
                      ? new Date(promotion.endsAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "no end"}
                  </>
                ) : null}
              </p>
              <OfferRowActions
                promotionId={promotion.id}
                effective={effective}
                baseStatus={promotion.status}
                hasRedemptions={promotion.usesCount > 0}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
