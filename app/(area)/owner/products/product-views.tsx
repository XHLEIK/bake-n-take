import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

import { cn } from "cn";

import { catalogAssetUrl } from "@/lib/catalog/repository";
import type { Product } from "@/lib/catalog/types";
import { formatPaise } from "@/lib/store/format";

import { ProductRowActions } from "./row-actions";

export type OwnerMoney = { currency: string; currencySymbol: string };

/**
 * Owner product presentations.
 *
 * Grid and List share the same repository rows, the same price derivation
 * (cheapest active variant else base, formatted from database paise) and the
 * same `ProductRowActions` — only the layout differs. Slugs stay out of the
 * visual hierarchy; the edit destination is unchanged.
 */

function cheapestPrice(product: Product): number {
  const cheapest = [...product.variants]
    .filter((variant) => variant.isActive)
    .sort((a, b) => a.pricePaise - b.pricePaise)[0];
  return cheapest ? cheapest.pricePaise : product.basePricePaise;
}

function priceLabel(product: Product, money: OwnerMoney): string {
  const hasPricedVariant = product.variants.some((variant) => variant.isActive);
  const amount = formatPaise(cheapestPrice(product), money);
  return hasPricedVariant ? `From ${amount}` : amount;
}

function metaLine(product: Product): string {
  const category = product.categoryName || "Uncategorized";
  const options = `${product.variants.length} option${product.variants.length === 1 ? "" : "s"}`;
  const flavours = `${product.flavours.length} flavour${product.flavours.length === 1 ? "" : "s"}`;
  return `${category} · ${options} · ${flavours}`;
}

export function ProductBadge({
  label,
  tone = "brand",
}: {
  label: string;
  tone?: "brand" | "muted";
}) {
  return (
    <span
      className={
        tone === "brand"
          ? "rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

function StatusBadges({ product }: { product: Product }) {
  const archived = product.archivedAt !== null;
  return (
    <>
      {product.isFeatured ? <ProductBadge label="Featured" /> : null}
      {product.isTrending ? <ProductBadge label="Trending" /> : null}
      {archived ? (
        <ProductBadge label="Archived" tone="muted" />
      ) : product.isActive ? null : (
        <ProductBadge label="Unavailable" tone="muted" />
      )}
    </>
  );
}

function ProductThumb({ product, size }: { product: Product; size: "lg" | "sm" }) {
  const primary = [...product.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0];
  const src = primary ? (catalogAssetUrl(primary.storagePath) ?? "") : "";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-muted/40",
        size === "lg" ? "aspect-[4/3] w-full" : "size-14 rounded-xl",
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true" className="font-heading text-xl text-muted-foreground">
          {product.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function OwnerProductGrid({ products, money }: { products: Product[]; money: OwnerMoney }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const archived = product.archivedAt !== null;
        const editHref = `/owner/products/${product.id}`;
        const badged = product.isFeatured || product.isTrending || archived || !product.isActive;
        return (
          <li
            key={product.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 transition-colors hover:border-primary/40"
          >
            <Link href={editHref} aria-hidden="true" tabIndex={-1} className="block outline-none">
              <ProductThumb product={product} size="lg" />
            </Link>
            <div className="grid flex-1 gap-1 p-4 pb-3">
              <Link
                href={editHref}
                className="truncate font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {product.name}
              </Link>
              <p className="text-sm font-semibold tabular-nums">{priceLabel(product, money)}</p>
              <p className="truncate text-xs text-muted-foreground">{metaLine(product)}</p>
              {badged ? (
                <p className="flex flex-wrap gap-1.5 pt-1">
                  <StatusBadges product={product} />
                </p>
              ) : null}
            </div>
            <div className="mt-auto border-t border-border/60 px-2 py-1.5">
              <ProductRowActions
                productId={product.id}
                isActive={product.isActive}
                archived={archived}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function OwnerProductList({ products, money }: { products: Product[]; money: OwnerMoney }) {
  return (
    <ul className="grid gap-2">
      {products.map((product) => {
        const archived = product.archivedAt !== null;
        const editHref = `/owner/products/${product.id}`;
        return (
          <li
            key={product.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40"
          >
            <Link
              href={editHref}
              aria-hidden="true"
              tabIndex={-1}
              className="block shrink-0 outline-none"
            >
              <ProductThumb product={product} size="sm" />
            </Link>
            <span className="grid min-w-0 flex-1 basis-48 gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={editHref}
                  className="truncate font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {product.name}
                </Link>
                <StatusBadges product={product} />
              </span>
              <span className="truncate text-xs text-muted-foreground">{metaLine(product)}</span>
            </span>
            <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
              {priceLabel(product, money)}
            </span>
            <ProductRowActions
              productId={product.id}
              isActive={product.isActive}
              archived={archived}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function ProductViewToggle({
  view,
  gridHref,
  listHref,
}: {
  view: "grid" | "list";
  gridHref: string;
  listHref: string;
}) {
  return (
    <div
      role="group"
      aria-label="Product display"
      className="inline-flex items-center gap-1 self-start rounded-xl border border-border bg-card p-1 sm:self-auto"
    >
      <Link
        href={gridHref}
        replace
        aria-pressed={view === "grid"}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          view === "grid"
            ? "bg-secondary font-semibold text-secondary-foreground"
            : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid aria-hidden="true" className="size-4" />
        Grid
      </Link>
      <Link
        href={listHref}
        replace
        aria-pressed={view === "list"}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          view === "list"
            ? "bg-secondary font-semibold text-secondary-foreground"
            : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        <List aria-hidden="true" className="size-4" />
        List
      </Link>
    </div>
  );
}
