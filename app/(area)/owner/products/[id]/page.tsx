import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/catalog/product-form";
import { requireOwner } from "@/lib/auth/session";
import { getOwnerProduct, listOwnerCategories } from "@/lib/catalog/owner-repository";

export const metadata: Metadata = { title: "Edit product" };

type EditParams = Promise<{ id: string }>;

/**
 * Owner product editor (Phase 3).
 *
 * Loads the full product with children; unknown ids 404. Every field edits
 * in place with diff-by-id saves, so touching the name never drops images,
 * options or flavours.
 */
export default async function EditProductPage({ params }: { params: EditParams }) {
  const { id } = await params;
  await requireOwner(`/owner/products/${id}`);

  const [product, categories] = await Promise.all([getOwnerProduct(id), listOwnerCategories()]);
  if (!product) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Owner console · Products
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Edit product
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          /{product.slug} · saved changes reach customers without a redeploy.
        </p>
      </div>

      <ProductForm
        mode="edit"
        product={product}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      />
    </main>
  );
}
