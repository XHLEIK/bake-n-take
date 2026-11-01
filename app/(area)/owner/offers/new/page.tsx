import type { Metadata } from "next";
import Link from "next/link";

import { requireOwner } from "@/lib/auth/session";
import { listBannerGallery, listOfferCatalog } from "@/lib/promotions/repository";
import { OfferForm } from "@/components/offers/offer-form";
import { emptyOfferForm } from "@/lib/promotions/form-defaults";

export const metadata: Metadata = { title: "New offer" };

/** Owner offer creation (Phase 5). New campaigns always start as drafts. */
export default async function NewOfferPage() {
  await requireOwner("/owner/offers/new");
  const [{ categories, products }, gallery] = await Promise.all([
    listOfferCatalog(),
    listBannerGallery(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/owner/offers" className="hover:underline">
          Offers
        </Link>
        {" · "}
        <span aria-current="page" className="text-foreground">
          New
        </span>
      </nav>
      <div className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Owner console
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          New offer
        </h1>
        <p className="text-sm text-muted-foreground">
          Offers start as drafts — activate them when the banner and rules are ready.
        </p>
      </div>
      <OfferForm
        mode="create"
        initial={emptyOfferForm()}
        categories={categories}
        products={products}
        gallery={gallery}
      />
    </main>
  );
}
