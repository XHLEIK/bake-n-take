import Link from "next/link";
import { ArrowUpDown, ListFilter, Search, Tag, X } from "lucide-react";
import { cn } from "cn";

import type { Category } from "@/lib/catalog/types";
import { PRODUCT_SORT_LABELS, PRODUCT_SORTS, type ProductSort } from "@/lib/catalog/repository";

import { FilterMenu, type FilterMenuLink } from "./filter-menu";

/**
 * Shop filter bar (server-rendered, plain GET form + link controls).
 *
 * Same mechanics as before — search, category, sort and the offers toggle
 * travel together in the URL, so refresh, back/forward and shared links
 * all preserve the filter state. Three pill controls sit in one wrapping
 * row: a Categories dropdown, a Sort dropdown, and an Offers toggle that
 * narrows the grid to products with an active campaign.
 */
export function ShopFilters({
  webstore,
  categories,
  activeCategory,
  activeSort,
  offersOnly,
  query,
}: {
  webstore: string;
  categories: Category[];
  activeCategory?: string;
  activeSort: ProductSort;
  offersOnly: boolean;
  query: string;
}) {
  const buildHref = (slug: string | undefined, sort: ProductSort, q: string, offers: boolean) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (slug) params.set("category", slug);
    if (sort !== "featured") params.set("sort", sort);
    if (offers) params.set("offers", "1");
    const suffix = params.toString();
    return suffix ? `${webstore}/shop?${suffix}` : `${webstore}/shop`;
  };

  const categoryLinks: FilterMenuLink[] = [
    {
      href: buildHref(undefined, activeSort, query, offersOnly),
      label: "All products",
      active: !activeCategory,
    },
    ...categories.map((row) => ({
      href: buildHref(row.slug, activeSort, query, offersOnly),
      label: row.name,
      active: activeCategory === row.slug,
    })),
  ];
  const sortLinks: FilterMenuLink[] = PRODUCT_SORTS.map((sort) => ({
    href: buildHref(activeCategory, sort, query, offersOnly),
    label: PRODUCT_SORT_LABELS[sort],
    active: activeSort === sort,
  }));
  const activeCategoryName = categories.find((row) => row.slug === activeCategory)?.name;

  return (
    <div className="grid gap-4">
      <form method="get" role="search" className="relative w-full">
        <label className="sr-only" htmlFor="shop-search">
          Search products
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="shop-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search cakes, cupcakes, cookies…"
          autoComplete="off"
          className="h-13 w-full rounded-2xl border border-input bg-card/70 pr-32 pl-11 text-sm shadow-[0_1px_2px_rgb(66_40_16/0.06)] transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:bg-card focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_10%,transparent)] [&::-webkit-search-cancel-button]:hidden"
        />
        {activeCategory ? <input type="hidden" name="category" value={activeCategory} /> : null}
        {activeSort !== "featured" ? <input type="hidden" name="sort" value={activeSort} /> : null}
        {offersOnly ? <input type="hidden" name="offers" value="1" /> : null}
        {query ? (
          <Link
            href={buildHref(activeCategory, activeSort, "", offersOnly)}
            aria-label="Clear search"
            title="Clear search"
            className="absolute top-1/2 right-[5.5rem] flex h-11 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
        <button
          type="submit"
          className="absolute top-1/2 right-1 h-11 -translate-y-1/2 cursor-pointer rounded-xl bg-secondary px-4 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          Search
        </button>
      </form>

      {/*
        One row at every breakpoint: three equal cells sharing the search
        bar's exact width — never wrapping, never overflowing. Labels
        truncate inside their 44px-tall cells; full values live in the
        dropdowns, which anchor per column on narrow screens.
      */}
      {/*
        One continuous segmented control: three equal cells sharing the
        search bar's exact width — never wrapping, never overflowing.
        Labels truncate inside their 44px-tall cells; full values live in
        the trigger-width dropdowns.
      */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border/70 bg-card/60 p-1">
        <div className="min-w-0">
          <FilterMenu
            icon={<ListFilter />}
            label={activeCategoryName ?? "Category"}
            sections={[{ heading: "Category", links: categoryLinks }]}
            active={Boolean(activeCategory)}
          />
        </div>
        <div className="min-w-0">
          <FilterMenu
            icon={<ArrowUpDown />}
            label={PRODUCT_SORT_LABELS[activeSort]}
            sections={[{ heading: "Sort by", links: sortLinks }]}
            active={activeSort !== "featured"}
          />
        </div>
        <Link
          href={buildHref(activeCategory, activeSort, query, !offersOnly)}
          scroll={false}
          aria-pressed={offersOnly}
          title={offersOnly ? "Show all products" : "Show only products with offers"}
          className={cn(
            "inline-flex h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-all duration-200 sm:gap-1.5 sm:px-3 sm:text-sm",
            offersOnly
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
          )}
        >
          <Tag aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">Offers</span>
        </Link>
      </div>
    </div>
  );
}
