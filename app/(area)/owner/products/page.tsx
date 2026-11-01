import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { CategoryManager } from "@/components/catalog/category-manager";
import { buttonVariants } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth/session";
import { listOwnerCategories, listOwnerProducts } from "@/lib/catalog/owner-repository";
import { getStoreSettings } from "@/lib/store/repository";

import { OwnerProductGrid, OwnerProductList, ProductViewToggle } from "./product-views";

export const metadata: Metadata = { title: "Products" };

type Search = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function withView(
  params: {
    q: string;
    categoryId?: string;
    status: string;
    featured?: boolean;
    trending?: boolean;
  },
  view: "grid" | "list",
): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.categoryId) search.set("category", params.categoryId);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.featured) search.set("featured", "1");
  if (params.trending) search.set("trending", "1");
  search.set("view", view);
  return `/owner/products?${search.toString()}`;
}

/**
 * Owner product console (Phase 3, redesigned hierarchy).
 *
 * Products are the primary content: a compact toolbar (search, category,
 * status, Grid/List) sits directly under the header, the category manager
 * ships collapsed as supporting UI, and the product list renders immediately
 * in the selected display mode. Server-rendered with the same repository
 * reads and Server Actions as before — only the presentation changed.
 */
export default async function OwnerProductsPage({ searchParams }: { searchParams: Search }) {
  await requireOwner("/owner/products");
  const params = await searchParams;

  const q = first(params.q);
  const categoryId = first(params.category) || undefined;
  const status = (["all", "active", "unavailable", "archived"] as const).includes(
    first(params.status) as "all",
  )
    ? (first(params.status) as "all" | "active" | "unavailable" | "archived")
    : "all";
  const featured = first(params.featured) === "1" ? true : undefined;
  const trending = first(params.trending) === "1" ? true : undefined;
  const view = first(params.view) === "list" ? "list" : "grid";

  const [products, categories, settings] = await Promise.all([
    listOwnerProducts({
      search: q || undefined,
      categoryId,
      status,
      featured,
      trending,
    }),
    listOwnerCategories(),
    getStoreSettings(),
  ]);

  const moneySettings = {
    currency: settings?.currency ?? "INR",
    currencySymbol: settings?.currencySymbol ?? "₹",
  };

  const filtered = q || categoryId || status !== "all" || featured || trending;
  const viewParams = { q, categoryId, status, featured, trending };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
            Owner console
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Products
          </h1>
          <p className="text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"} · prices in{" "}
            {moneySettings.currency}
          </p>
        </div>
        <Link
          href="/owner/products/new"
          className={buttonVariants({ size: "lg" }) + " h-11 rounded-xl"}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add product
        </Link>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 lg:flex-row lg:items-end"
      >
        <label className="grid flex-1 gap-1.5 text-xs font-medium sm:min-w-52">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Search products…"
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm font-normal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium sm:min-w-44">
          Category
          <select
            name="category"
            defaultValue={categoryId ?? ""}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium sm:min-w-36">
          Status
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="all">All</option>
            <option value="active">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {featured ? <input type="hidden" name="featured" value="1" /> : null}
        {trending ? <input type="hidden" name="trending" value="1" /> : null}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="h-10 rounded-xl bg-secondary px-5 text-sm font-medium text-secondary-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Apply
          </button>
          {filtered ? (
            <Link
              href="/owner/products"
              className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </Link>
          ) : null}
        </div>
        <div className="lg:ml-auto">
          <ProductViewToggle
            view={view}
            gridHref={withView(viewParams, "grid")}
            listHref={withView(viewParams, "list")}
          />
        </div>
      </form>

      <section aria-label="Products" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Products
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {products.length} product{products.length === 1 ? "" : "s"}
            </span>
          </h2>
        </div>

        {products.length === 0 ? (
          filtered ? (
            <div className="grid gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
              <p className="font-medium">No products found</p>
              <p className="text-sm text-muted-foreground">Try changing your search or filters.</p>
              <p>
                <Link
                  href="/owner/products"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Clear filters
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
              <p className="font-medium">No products yet</p>
              <p className="mx-auto max-w-md text-sm text-pretty text-muted-foreground">
                Start building your bakery menu by adding your first product.
              </p>
              <p>
                <Link
                  href="/owner/products/new"
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-secondary px-5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  Add product
                </Link>
              </p>
            </div>
          )
        ) : view === "grid" ? (
          <OwnerProductGrid products={products} money={moneySettings} />
        ) : (
          <OwnerProductList products={products} money={moneySettings} />
        )}
      </section>

      <CategoryManager categories={categories} />
    </main>
  );
}
