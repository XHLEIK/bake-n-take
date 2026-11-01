import type { Metadata } from "next";
import Link from "next/link";

import { ProductForm } from "@/components/catalog/product-form";
import { requireOwner } from "@/lib/auth/session";
import { listOwnerCategories } from "@/lib/catalog/owner-repository";

export const metadata: Metadata = { title: "New product" };

/**
 * Owner product creation (Phase 3).
 *
 * The form posts to `createProductAction`, which redirects to the edit page
 * on success. Categories are loaded for the select; products without one
 * stay uncategorized until assigned.
 */
export default async function NewProductPage() {
  await requireOwner("/owner/products/new");
  const categories = await listOwnerCategories();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Owner console · Products
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          New product
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          Describe the product once — name, images, options and flavours flow straight to the
          customer storefront when you save.
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
          No categories yet — the product will stay uncategorized until you add one below.{" "}
          <Link
            href="/owner/products#categories"
            className="font-medium text-primary hover:underline"
          >
            Manage categories
          </Link>
        </p>
      ) : null}

      <ProductForm
        mode="create"
        product={null}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      />
    </main>
  );
}
