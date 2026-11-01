"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/auth/form-field";
import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { createHeroItemAction, updateHeroItemAction } from "@/lib/hero/actions";
import type { Category } from "@/lib/catalog/types";
import type { OfferCatalogProduct } from "@/lib/promotions/repository";
import { HERO_TYPES } from "@/lib/hero/types";
import type { HeroFormInitial } from "@/lib/hero/form-defaults";

export type HeroPromotionOption = {
  id: string;
  name: string;
  status: string;
};

/**
 * Guided hero form (Phase 5.1).
 *
 * Only the fields relevant to the selected content type render. Source
 * pickers post ids; the preview below renders exactly what the customer
 * carousel will show (desktop + mobile widths) without publishing anything.
 */
export function HeroForm({
  mode,
  initial,
  promotions,
  categories,
  products,
  gallery,
}: {
  mode: "create" | "edit";
  initial: HeroFormInitial;
  promotions: HeroPromotionOption[];
  categories: Category[];
  products: OfferCatalogProduct[];
  gallery: { path: string; url: string }[];
}) {
  const [state, formAction] = useActionState(
    mode === "create" ? createHeroItemAction : updateHeroItemAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const [type, setType] = useState<HeroFormInitial["type"]>(initial.type);
  const [destType, setDestType] = useState(initial.destType);
  const [galleryPath, setGalleryPath] = useState(initial.galleryImagePath);
  const [preview, setPreview] = useState({
    title: initial.title,
    description: initial.description,
    cta: initial.ctaLabel,
  });

  const fieldError = (name: string): string | undefined => state.fieldErrors?.[name];
  const formError = state.status === "error" && state.message ? state.message : null;
  const sourceName =
    type === "offer"
      ? (promotions.find((p) => p.id === initial.promotionId)?.name ?? null)
      : type === "product"
        ? (products.find((p) => p.id === initial.productId)?.name ?? null)
        : type === "category"
          ? (categories.find((c) => c.id === initial.categoryId)?.name ?? null)
          : null;

  return (
    <form action={formAction} className="grid gap-6">
      {mode === "edit" ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="galleryImagePath" value={galleryPath} />

      {formError ? <InlineMessage variant="error" message={formError} /> : null}
      {state.status === "success" && state.message ? (
        <InlineMessage variant="success" message={state.message} />
      ) : null}

      <section
        aria-label="Content type"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">Content</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-xs font-medium">
            Slide type
            <select
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as HeroFormInitial["type"])}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              {HERO_TYPES.filter((option) => option !== "system").map((option) => (
                <option key={option} value={option}>
                  {option === "offer"
                    ? "Offer"
                    : option === "product"
                      ? "Featured product"
                      : option === "category"
                        ? "Category highlight"
                        : option === "announcement"
                          ? "Announcement"
                          : "Custom campaign"}
                </option>
              ))}
            </select>
          </label>
          <FormField
            label="Manual order"
            name="displayOrder"
            inputMode="numeric"
            required
            defaultValue={initial.displayOrder}
            error={fieldError("displayOrder")}
          />
          <FormField
            label="Priority (higher wins ties)"
            name="priority"
            inputMode="numeric"
            required
            defaultValue={initial.priority}
            error={fieldError("priority")}
          />
        </div>

        {type === "offer" ? (
          <label className="grid gap-1.5 text-xs font-medium">
            Offer to feature
            <select
              name="promotionId"
              defaultValue={initial.promotionId}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              <option value="">Pick an offer…</option>
              {promotions.map((promotion) => (
                <option key={promotion.id} value={promotion.id}>
                  {promotion.name} ({promotion.status})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fieldError("promotionId") ? (
          <InlineMessage variant="error" message={fieldError("promotionId")!} />
        ) : null}

        {type === "product" ? (
          <label className="grid gap-1.5 text-xs font-medium">
            Product to feature
            <select
              name="productId"
              defaultValue={initial.productId}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              <option value="">Pick a product…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fieldError("productId") ? (
          <InlineMessage variant="error" message={fieldError("productId")!} />
        ) : null}

        {type === "category" ? (
          <label className="grid gap-1.5 text-xs font-medium">
            Category to feature
            <select
              name="categoryId"
              defaultValue={initial.categoryId}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              <option value="">Pick a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fieldError("categoryId") ? (
          <InlineMessage variant="error" message={fieldError("categoryId")!} />
        ) : null}

        {(type === "announcement" ||
          type === "campaign" ||
          type === "product" ||
          type === "category") && (
          <FormField
            label={
              type === "announcement" || type === "campaign"
                ? "Headline"
                : "Custom headline (blank = source name)"
            }
            name="title"
            maxLength={120}
            required={type === "announcement" || type === "campaign"}
            defaultValue={initial.title}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setPreview((p) => ({ ...p, title: event.target.value }))
            }
            error={fieldError("title")}
          />
        )}
        {(type === "announcement" ||
          type === "campaign" ||
          type === "product" ||
          type === "category") && (
          <label className="grid gap-1.5 text-xs font-medium">
            Description (blank = source default)
            <textarea
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={initial.description}
              onChange={(event) => setPreview((p) => ({ ...p, description: event.target.value }))}
              className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-normal"
            />
          </label>
        )}
        <FormField
          label="Button label (blank = Explore)"
          name="ctaLabel"
          maxLength={40}
          defaultValue={initial.ctaLabel}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setPreview((p) => ({ ...p, cta: event.target.value }))
          }
          error={fieldError("ctaLabel")}
        />
      </section>

      <section
        aria-label="Schedule"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold sm:col-span-2">Schedule</h2>
        <FormField
          label="Starts at (IST)"
          name="startsAt"
          type="datetime-local"
          defaultValue={initial.startsAt}
          error={fieldError("startsAt")}
        />
        <FormField
          label="Ends at (IST)"
          name="endsAt"
          type="datetime-local"
          defaultValue={initial.endsAt}
          error={fieldError("endsAt")}
        />
      </section>

      <section
        aria-label="Image"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">Image</h2>
        <label className="grid gap-1.5 text-xs font-medium">
          Upload (PNG/JPEG/WebP, ≤ 2 MB)
          <input
            type="file"
            name="heroImage"
            accept="image/png,image/jpeg,image/webp"
            className="text-sm font-normal file:mr-3 file:h-10 file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:text-sm file:font-medium"
          />
        </label>
        {gallery.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium">Or reuse a gallery image</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Gallery images">
              {gallery.map((entry) => (
                <label
                  key={entry.path}
                  className="cursor-pointer rounded-xl border-2 border-transparent has-checked:border-primary"
                >
                  <input
                    type="radio"
                    name="gallery pick"
                    checked={galleryPath === entry.path}
                    onChange={() => setGalleryPath(entry.path)}
                    className="sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.url}
                    alt=""
                    aria-hidden="true"
                    className="size-16 rounded-lg object-cover"
                  />
                </label>
              ))}
              {galleryPath ? (
                <button
                  type="button"
                  onClick={() => setGalleryPath("")}
                  className="h-8 self-center rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Clear selection
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {initial.bannerImageUrl ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="removeImage" className="size-4 accent-current" />
            Remove the current image
          </label>
        ) : null}
      </section>

      {(type === "announcement" || type === "campaign") && (
        <section
          aria-label="Destination"
          className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
        >
          <h2 className="font-heading text-base font-semibold">Destination</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-medium">
              Goes to
              <select
                name="destType"
                value={destType}
                onChange={(event) => setDestType(event.target.value as typeof destType)}
                className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
              >
                <option value="store">Bake list</option>
                <option value="category">Category</option>
                <option value="product">Product</option>
              </select>
            </label>
            {destType === "category" ? (
              <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">
                Category
                <select
                  name="destCategoryId"
                  defaultValue={initial.destCategoryId}
                  className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
                >
                  <option value="">Pick a category…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {destType === "product" ? (
              <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">
                Product
                <select
                  name="destProductId"
                  defaultValue={initial.destProductId}
                  className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
                >
                  <option value="">Pick a product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {(fieldError("destCategoryId") || fieldError("destProductId")) && (
            <InlineMessage
              variant="error"
              message={fieldError("destCategoryId") ?? fieldError("destProductId")!}
            />
          )}
        </section>
      )}

      <section
        aria-label="Preview"
        className="grid gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">
          Preview (unsaved changes stay local)
        </h2>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Desktop</p>
            <HeroPreview
              title={preview.title || sourceName || "Untitled slide"}
              description={preview.description}
              cta={preview.cta || "Explore"}
              imageUrl={
                gallery.find((entry) => entry.path === galleryPath)?.url ?? initial.bannerImageUrl
              }
            />
          </div>
          <div className="grid content-start gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Mobile</p>
            <div className="max-w-[280px]">
              <HeroPreview
                title={preview.title || sourceName || "Untitled slide"}
                description={preview.description}
                cta={preview.cta || "Explore"}
                imageUrl={
                  gallery.find((entry) => entry.path === galleryPath)?.url ?? initial.bannerImageUrl
                }
              />
            </div>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 flex gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <SubmitButton pendingLabel={mode === "create" ? "Creating…" : "Saving…"}>
          {mode === "create" ? "Create slide" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}

function HeroPreview({
  title,
  description,
  cta,
  imageUrl,
}: {
  title: string;
  description: string;
  cta: string;
  imageUrl: string | null;
}) {
  return (
    <div className="relative grid min-h-44 gap-1.5 overflow-hidden rounded-2xl bg-secondary p-5 text-white">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="relative grid content-center gap-1.5 rounded-xl bg-black/45 p-3 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
        <p className="font-heading text-lg font-semibold text-balance">{title}</p>
        {description ? <p className="max-w-md text-xs opacity-90">{description}</p> : null}
        <p className="text-xs font-semibold underline underline-offset-4">{cta}</p>
      </div>
    </div>
  );
}
