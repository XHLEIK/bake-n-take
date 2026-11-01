import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Category, ProductCard as ProductCardData } from "@/lib/catalog/types";
import { ProductCard } from "@/components/catalog/product-card";
import { SectionHeader } from "@/components/site/section-header";
import { CategoryFilter, type CategoryOption } from "./category-filter";

const PANEL_LIMIT = 8;

/**
 * Homepage category browser.
 *
 * A curated discovery component — never a category directory. The server
 * ranks live categories by real product count and keeps the five most
 * populated (stable order, so catalogue edits adapt deterministically);
 * "All Products" plus a Bake List arrow complete the six-option selector.
 * Every panel below is pre-rendered with the existing ProductCard, so
 * switching filters is instant client state with zero refetching and zero
 * duplicated product logic.
 */
export function CategoryBrowser({
  webstore,
  categories,
  counts,
  products,
  money,
}: {
  webstore: string;
  categories: Category[];
  /** Live product counts by category slug, computed from real catalog rows. */
  counts: Map<string, number>;
  /** Full live catalog — panels slice from the same rows the shop uses. */
  products: ProductCardData[];
  money: { currency: string; currencySymbol: string };
}) {
  const top = [...categories]
    .sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0))
    .slice(0, 5);
  if (top.length === 0) return null;

  const options: CategoryOption[] = [
    { key: "all", label: "All Products", count: products.length },
    ...top.map((category) => ({
      key: category.slug,
      label: category.name,
      count: counts.get(category.slug) ?? 0,
    })),
  ];

  const panels: Record<string, React.ReactNode> = {
    all: (
      <CategoryPanel
        title="All Products"
        subline={
          products.length === 0
            ? "Nothing baked yet."
            : products.length > PANEL_LIMIT
              ? `Fresh from the counter · showing ${PANEL_LIMIT} of ${products.length}`
              : `Fresh from the counter · ${products.length} bake${products.length === 1 ? "" : "s"}`
        }
      >
        {products.length === 0 ? (
          <CategoryEmpty webstore={webstore} />
        ) : (
          <ProductGrid cards={products.slice(0, PANEL_LIMIT)} webstore={webstore} money={money} />
        )}
      </CategoryPanel>
    ),
  };
  for (const category of top) {
    const cards = products.filter((card) => card.categorySlug === category.slug);
    panels[category.slug] = (
      <CategoryPanel
        title={category.name}
        subline={
          cards.length === 0
            ? "No bakes here yet."
            : cards.length > PANEL_LIMIT
              ? `${cards.length} bakes · showing ${PANEL_LIMIT}`
              : `${cards.length} bake${cards.length === 1 ? "" : "s"}`
        }
      >
        {cards.length === 0 ? (
          <CategoryEmpty webstore={webstore} name={category.name} />
        ) : (
          <ProductGrid cards={cards.slice(0, PANEL_LIMIT)} webstore={webstore} money={money} />
        )}
      </CategoryPanel>
    );
  }

  return (
    <section aria-label="Categories" className="grid gap-6">
      <SectionHeader
        eyebrow="The counter"
        title="Browse by craving"
        action={
          <Link
            href={`${webstore}/shop`}
            aria-label="View the complete Bake List"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            View Bake List
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />
      <CategoryFilter options={options} panels={panels} />
    </section>
  );
}

function CategoryPanel({
  title,
  subline,
  children,
}: {
  title: string;
  subline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h3 className="font-serif text-2xl font-medium tracking-[-0.01em]">{title}</h3>
        <p className="text-xs text-muted-foreground">{subline}</p>
      </div>
      {children}
    </div>
  );
}

function ProductGrid({
  cards,
  webstore,
  money,
}: {
  cards: ProductCardData[];
  webstore: string;
  money: { currency: string; currencySymbol: string };
}) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <li key={card.id}>
          <ProductCard card={card} webstore={webstore} money={money} />
        </li>
      ))}
    </ul>
  );
}

function CategoryEmpty({ webstore, name }: { webstore: string; name?: string }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-serif text-xl font-medium">
        {name ? `Nothing from this craving yet.` : `Nothing baked yet.`}
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Check back soon or explore the full bake list.
      </p>
      <Link
        href={`${webstore}/shop`}
        className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-xl bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
      >
        View the Bake List
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
