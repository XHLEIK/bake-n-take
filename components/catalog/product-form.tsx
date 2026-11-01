"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { FormField } from "@/components/auth/form-field";
import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { SectionCard, SettingsSwitch, SettingsTextArea } from "@/components/store/fields";
import { isoToIstLocal } from "@/lib/promotions/validation";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import {
  createProductAction,
  deleteProductAction,
  setProductArchivedAction,
  updateProductAction,
} from "@/lib/catalog/actions";
import { catalogAssetUrl } from "@/lib/catalog/repository";
import type { Product, VariantMode } from "@/lib/catalog/types";

import { ImageManager, type ExistingImageDraft, type StagedFile } from "./image-manager";
import { FlavourRows, VariantRows, type FlavourDraft, type VariantDraft } from "./option-editors";

export type ProductFormCategory = { id: string; name: string };

/**
 * Owner product editor, shared by create and edit.
 *
 * One form, one explicit save: options and images edit locally (existing rows
 * keep their ids so the server diffs instead of wiping), new images stage as
 * files, and the save action validates → writes → uploads → revalidates.
 * Prices travel as rupee strings and become paise server-side; no total is
 * ever accepted from the client.
 */
export function ProductForm({
  mode,
  product,
  categories,
}: {
  mode: "create" | "edit";
  product: Product | null;
  categories: ProductFormCategory[];
}) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction] = useActionState(action, INITIAL_AUTH_FORM_STATE);

  const [texts, setTexts] = useState(() => snapshotTexts(product));
  const [flags, setFlags] = useState(() => ({
    isActive: product?.isActive ?? true,
    isFeatured: product?.isFeatured ?? false,
    isTrending: product?.isTrending ?? false,
    allowCustomDesign: product?.allowCustomDesign ?? false,
    eggEgglessEnabled: product?.eggEgglessEnabled ?? false,
    messageEnabled: product?.messageEnabled ?? false,
    isNew: product?.isNew ?? false,
    heroFeatured: product?.heroFeatured ?? false,
    heroEnabled: true,
  }));
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (product?.variants ?? []).map((row) => ({
      key: row.id,
      id: row.id,
      label: row.label,
      value: row.value ?? "",
      priceRupees: String(row.pricePaise / 100),
      isActive: row.isActive,
    })),
  );
  const [flavours, setFlavours] = useState<FlavourDraft[]>(() =>
    (product?.flavours ?? []).map((row) => ({
      key: row.id,
      id: row.id,
      name: row.name,
      surchargeRupees: row.surchargePaise === 0 ? "" : String(row.surchargePaise / 100),
      isActive: row.isActive,
    })),
  );
  const [existingImages, setExistingImages] = useState<ExistingImageDraft[]>(() =>
    (product?.images ?? []).map((image) => ({
      id: image.id,
      url: catalogAssetUrl(image.storagePath),
      altText: image.altText,
      isPrimary: image.isPrimary,
      removed: false,
      confirmingRemove: false,
    })),
  );
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const baseline = JSON.stringify(snapshot(product));
  const snapshotNow = useMemo(
    () =>
      JSON.stringify({
        texts,
        flags,
        variants: stripKeys(variants),
        flavours: stripKeys(flavours),
        images: existingImages.map(({ id, altText, isPrimary, removed }) => ({
          id,
          altText,
          isPrimary,
          removed,
        })),
        staged: stagedFiles.map((entry) => `${entry.file.name}:${entry.file.size}`),
      }),
    [texts, flags, variants, flavours, existingImages, stagedFiles],
  );
  const dirty =
    state.status === "success" && submitted !== null && snapshotNow === submitted
      ? false
      : snapshotNow !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function setText(key: keyof typeof texts) {
    return (value: string) => setTexts((previous) => ({ ...previous, [key]: value }));
  }

  function setFlag(key: keyof typeof flags) {
    return (value: boolean) => setFlags((previous) => ({ ...previous, [key]: value }));
  }

  function resetAll() {
    setTexts(snapshotTexts(product));
    setFlags({
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      isTrending: product?.isTrending ?? false,
      allowCustomDesign: product?.allowCustomDesign ?? false,
      eggEgglessEnabled: product?.eggEgglessEnabled ?? false,
      messageEnabled: product?.messageEnabled ?? false,
      isNew: product?.isNew ?? false,
      heroFeatured: product?.heroFeatured ?? false,
      heroEnabled: true,
    });
    setVariants(
      (product?.variants ?? []).map((row) => ({
        key: row.id,
        id: row.id,
        label: row.label,
        value: row.value ?? "",
        priceRupees: String(row.pricePaise / 100),
        isActive: row.isActive,
      })),
    );
    setFlavours(
      (product?.flavours ?? []).map((row) => ({
        key: row.id,
        id: row.id,
        name: row.name,
        surchargeRupees: row.surchargePaise === 0 ? "" : String(row.surchargePaise / 100),
        isActive: row.isActive,
      })),
    );
    setExistingImages(
      (product?.images ?? []).map((image) => ({
        id: image.id,
        url: catalogAssetUrl(image.storagePath),
        altText: image.altText,
        isPrimary: image.isPrimary,
        removed: false,
        confirmingRemove: false,
      })),
    );
    setStagedFiles([]);
    setSubmitted(null);
  }

  const errors = state.fieldErrors ?? {};
  const showVariants = texts.variantMode === "size" || texts.variantMode === "quantity";

  return (
    <>
      <form action={formAction} onSubmit={() => setSubmitted(snapshotNow)} className="grid gap-6">
        {mode === "edit" && product ? <input type="hidden" name="id" value={product.id} /> : null}
        <input type="hidden" name="variantsJson" value={JSON.stringify(stripKeys(variants))} />
        <input type="hidden" name="flavoursJson" value={JSON.stringify(stripKeys(flavours))} />
        <input
          type="hidden"
          name="imagesJson"
          value={JSON.stringify(
            existingImages.map(({ id, altText, isPrimary, removed }) => ({
              id,
              altText,
              isPrimary,
              removed,
            })),
          )}
        />

        {state.status === "error" && state.message ? (
          <InlineMessage variant="error" message={state.message} />
        ) : null}
        {state.status === "success" && state.message ? (
          <InlineMessage variant="success" message={state.message} />
        ) : null}
        {mode === "edit" && product?.archivedAt ? (
          <InlineMessage
            variant="info"
            message="This product is archived — customers cannot see it. Restore it below to sell again."
          />
        ) : null}

        <SectionCard title="Basic information" description="Name, category and descriptions.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Product name"
              name="name"
              required
              maxLength={120}
              value={texts.name}
              onChange={(event) => setText("name")(event.currentTarget.value)}
              error={errors.name}
            />
            <div className="grid gap-2">
              <label htmlFor="categoryId" className="text-[0.8125rem] font-medium">
                Category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                value={texts.categoryId}
                onChange={(event) => setText("categoryId")(event.currentTarget.value)}
                aria-invalid={errors.categoryId ? true : undefined}
                className="h-11 rounded-xl border border-input bg-card/70 px-3 text-base shadow-xs"
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {errors.categoryId}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Optional — uncategorized products still show under All.
                </p>
              )}
            </div>
          </div>
          <FormField
            label="Short description"
            name="shortDescription"
            maxLength={200}
            hint="One line for product cards."
            value={texts.shortDescription}
            onChange={(event) => setText("shortDescription")(event.currentTarget.value)}
            error={errors.shortDescription}
          />
          <SettingsTextArea
            label="Full description"
            name="description"
            rows={4}
            maxLength={2000}
            value={texts.description}
            onChange={setText("description")}
            error={errors.description}
          />
        </SectionCard>

        <SectionCard
          title="Media"
          description="First image is the card image unless starred otherwise."
        >
          <ImageManager
            existing={existingImages}
            onExistingChange={setExistingImages}
            staged={stagedFiles}
            onStagedChange={setStagedFiles}
            error={errors.imagesJson}
          />
        </SectionCard>

        <SectionCard
          title="Pricing and variants"
          description="Base price applies when a product has no options. Sizes or quantities carry their own prices."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Base price ₹"
              name="basePriceRupees"
              inputMode="decimal"
              placeholder="600"
              hint="Used when no variant is selected."
              value={texts.basePriceRupees}
              onChange={(event) => setText("basePriceRupees")(event.currentTarget.value)}
              error={errors.basePriceRupees}
            />
            <div className="grid gap-2">
              <label htmlFor="variantMode" className="text-[0.8125rem] font-medium">
                Variant mode
              </label>
              <select
                id="variantMode"
                name="variantMode"
                value={texts.variantMode}
                onChange={(event) => {
                  const mode = event.currentTarget.value as VariantMode;
                  setText("variantMode")(mode);
                  if (mode === "none") setVariants([]);
                }}
                className="h-11 rounded-xl border border-input bg-card/70 px-3 text-base shadow-xs"
              >
                <option value="none">No variants</option>
                <option value="size">Size / weight</option>
                <option value="quantity">Quantity / batch</option>
              </select>
            </div>
          </div>
          {showVariants ? (
            <VariantRows rows={variants} onChange={setVariants} error={errors.variantsJson} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Variant mode is off — switching it on clears nothing, but options only apply in size
              or quantity mode.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Flavours"
          description="Optional per-product flavours with surcharges stored in paise."
        >
          <FlavourRows rows={flavours} onChange={setFlavours} error={errors.flavoursJson} />
        </SectionCard>

        <SectionCard
          title="Customization"
          description="Egg choice, cake message and customer design uploads."
        >
          <SettingsSwitch
            label="Egg / eggless choice"
            description="Customers pick egg or eggless on the product page."
            name="eggEgglessEnabled"
            checked={flags.eggEgglessEnabled}
            onChange={setFlag("eggEgglessEnabled")}
          />
          {flags.eggEgglessEnabled ? (
            <FormField
              label="Eggless surcharge ₹"
              name="egglessSurchargeRupees"
              inputMode="decimal"
              placeholder="0"
              value={texts.egglessSurchargeRupees}
              onChange={(event) => setText("egglessSurchargeRupees")(event.currentTarget.value)}
              error={errors.egglessSurchargeRupees}
            />
          ) : null}
          <SettingsSwitch
            label="Cake message"
            description="Let customers add a message for the cake."
            name="messageEnabled"
            checked={flags.messageEnabled}
            onChange={setFlag("messageEnabled")}
          />
          <SettingsSwitch
            label="Allow customer custom design"
            description="Shows an image upload on the product page. Files stay private drafts — no order is created."
            name="allowCustomDesign"
            checked={flags.allowCustomDesign}
            onChange={setFlag("allowCustomDesign")}
          />
        </SectionCard>

        <SectionCard
          title="Preparation"
          description="Minimum lead time before a customer may request pickup."
        >
          <FormField
            label="Minimum preparation time (hours)"
            name="prepHours"
            inputMode="decimal"
            list="prep-hour-presets"
            placeholder="12"
            hint="Blank means 12 hours. 0 means ready now. Use decimals for sub-hour prep (0.5 = 30 minutes). Customers can only pick slots at least this far ahead."
            value={texts.prepHours}
            onChange={(event) => setText("prepHours")(event.currentTarget.value)}
            error={errors.prepHours}
          />
          <datalist id="prep-hour-presets">
            {[0, 0.5, 1, 2, 4, 6, 12, 24, 48, 72].map((hours) => (
              <option key={hours} value={hours} />
            ))}
          </datalist>
        </SectionCard>

        <SectionCard title="Merchandising" description="Featuring, ordering and visibility.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsSwitch
              label="Available"
              description="Off marks the product unavailable (still visible)."
              name="isActive"
              checked={flags.isActive}
              onChange={setFlag("isActive")}
            />
            <FormField
              label="Display order"
              name="displayOrder"
              inputMode="numeric"
              placeholder="0"
              value={texts.displayOrder}
              onChange={(event) => setText("displayOrder")(event.currentTarget.value)}
              error={errors.displayOrder}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsSwitch
              label="Featured"
              description="Shows in the featured section."
              name="isFeatured"
              checked={flags.isFeatured}
              onChange={setFlag("isFeatured")}
            />
            <SettingsSwitch
              label="Trending"
              description="Shows in the trending section."
              name="isTrending"
              checked={flags.isTrending}
              onChange={setFlag("isTrending")}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Store Visibility & Promotion"
          description="New-arrival merchandising and hero carousel featuring."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsSwitch
              label="Mark as New"
              description="Eligible for automatic new-arrival merchandising."
              name="isNew"
              checked={flags.isNew}
              onChange={setFlag("isNew")}
            />
            {flags.isNew ? (
              <FormField
                label="New until (IST date)"
                name="newUntil"
                type="date"
                value={texts.newUntil}
                onChange={(event) => setText("newUntil")(event.currentTarget.value)}
                error={errors.newUntil}
              />
            ) : null}
          </div>
          <SettingsSwitch
            label="Feature in Hero Carousel"
            description="Keeps one managed hero slide for this product."
            name="heroFeatured"
            checked={flags.heroFeatured}
            onChange={setFlag("heroFeatured")}
          />
          {flags.heroFeatured ? (
            <div className="grid gap-4">
              <SettingsSwitch
                label="Hero slide enabled"
                description="Off pauses the slide without deleting it."
                name="heroEnabled"
                checked={flags.heroEnabled}
                onChange={setFlag("heroEnabled")}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Hero title (blank = product name)"
                  name="heroTitle"
                  maxLength={120}
                  value={texts.heroTitle}
                  onChange={(event) => setText("heroTitle")(event.currentTarget.value)}
                  error={errors.heroTitle}
                />
                <FormField
                  label="Hero button (blank = Shop now)"
                  name="heroCta"
                  maxLength={40}
                  value={texts.heroCta}
                  onChange={(event) => setText("heroCta")(event.currentTarget.value)}
                  error={errors.heroCta}
                />
              </div>
              <FormField
                label="Hero description (blank = short description)"
                name="heroDescription"
                maxLength={500}
                value={texts.heroDescription}
                onChange={(event) => setText("heroDescription")(event.currentTarget.value)}
                error={errors.heroDescription}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  label="Hero priority"
                  name="heroPriority"
                  inputMode="numeric"
                  value={texts.heroPriority}
                  onChange={(event) => setText("heroPriority")(event.currentTarget.value)}
                  error={errors.heroPriority}
                />
                <FormField
                  label="Hero starts (IST)"
                  name="heroStartsAt"
                  type="datetime-local"
                  value={texts.heroStartsAt}
                  onChange={(event) => setText("heroStartsAt")(event.currentTarget.value)}
                  error={errors.heroStartsAt}
                />
                <FormField
                  label="Hero ends (IST)"
                  name="heroEndsAt"
                  type="datetime-local"
                  value={texts.heroEndsAt}
                  onChange={(event) => setText("heroEndsAt")(event.currentTarget.value)}
                  error={errors.heroEndsAt}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-medium">
                  Hero image (PNG/JPEG/WebP, ≤ 2 MB)
                  <input
                    type="file"
                    name="heroImage"
                    accept="image/png,image/jpeg,image/webp"
                    className="text-sm font-normal file:mr-3 file:h-10 file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:text-sm file:font-medium"
                  />
                </label>
                <FormField
                  label="Or gallery path (banners/…)"
                  name="heroGalleryPath"
                  placeholder="banners/predefined-bread.jpg"
                  value={texts.heroGalleryPath}
                  onChange={(event) => setText("heroGalleryPath")(event.currentTarget.value)}
                  error={errors.heroGalleryPath}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Without an image the slide falls back to the product photo, then a gallery image.
                Full banner and destination control lives in Owner → Hero Carousel.
              </p>
            </div>
          ) : null}
        </SectionCard>

        <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="px-1 text-xs text-muted-foreground">
            {dirty ? "You have unsaved changes." : "Everything is saved."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetAll}
              disabled={!dirty}
              className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              Reset changes
            </button>
            <div className="min-w-44 flex-1 sm:flex-none">
              <SubmitButton pendingLabel={mode === "create" ? "Creating…" : "Saving…"}>
                {mode === "create" ? "Create product" : "Save product"}
              </SubmitButton>
            </div>
          </div>
        </div>
      </form>
      {mode === "edit" && product ? (
        <ProductDangerZone productId={product.id} archived={product.archivedAt !== null} />
      ) : null}
    </>
  );
}

function ProductDangerZone({ productId, archived }: { productId: string; archived: boolean }) {
  const [archiveState, archiveAction] = useActionState(
    setProductArchivedAction.bind(null, productId, !archived),
    INITIAL_AUTH_FORM_STATE,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <SectionCard
      title="Danger zone"
      description="Archiving hides the product but keeps its history. Deletion is permanent."
    >
      {archiveState.status === "error" && archiveState.message ? (
        <InlineMessage variant="error" message={archiveState.message} />
      ) : null}
      {archiveState.status === "success" && archiveState.message ? (
        <InlineMessage variant="success" message={archiveState.message} />
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={archiveAction}>
          <SubmitButton pendingLabel={archived ? "Restoring…" : "Archiving…"}>
            {archived ? "Restore product" : "Archive product"}
          </SubmitButton>
        </form>
        {confirmingDelete ? (
          <form
            action={async () => {
              await deleteProductAction(productId);
            }}
            className="flex gap-2"
          >
            <SubmitButton pendingLabel="Deleting…">Confirm delete</SubmitButton>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Keep
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="h-11 rounded-xl px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Delete product…
          </button>
        )}
      </div>
    </SectionCard>
  );
}

type SnapshotTexts = Record<string, string>;

function snapshotTexts(product: Product | null): SnapshotTexts {
  return {
    name: product?.name ?? "",
    shortDescription: product?.shortDescription ?? "",
    description: product?.description ?? "",
    basePriceRupees: product ? String(product.basePricePaise / 100) : "",
    categoryId: product?.categoryId ?? "",
    variantMode: product?.variantMode ?? "none",
    egglessSurchargeRupees:
      product && product.egglessSurchargePaise > 0
        ? String(product.egglessSurchargePaise / 100)
        : "",
    displayOrder: product ? String(product.displayOrder) : "",
    prepHours: product ? String(Math.round((product.minPrepMinutes / 60) * 100) / 100) : "",
    newUntil: product?.newUntil ? isoToIstLocal(product.newUntil).slice(0, 10) : "",
    heroTitle: "",
    heroDescription: "",
    heroCta: "",
    heroPriority: "100",
    heroStartsAt: "",
    heroEndsAt: "",
    heroGalleryPath: "",
  };
}

function stripKeys(rows: (VariantDraft | FlavourDraft)[]): Record<string, unknown>[] {
  return rows.map((row) => {
    if ("label" in row) {
      return {
        id: row.id,
        label: row.label,
        value: row.value,
        priceRupees: row.priceRupees,
        isActive: row.isActive,
      };
    }
    return {
      id: row.id,
      name: row.name,
      surchargeRupees: row.surchargeRupees,
      isActive: row.isActive,
    };
  });
}

function snapshot(product: Product | null): Record<string, unknown> {
  return {
    texts: snapshotTexts(product),
    flags: {
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      isTrending: product?.isTrending ?? false,
      allowCustomDesign: product?.allowCustomDesign ?? false,
      eggEgglessEnabled: product?.eggEgglessEnabled ?? false,
      messageEnabled: product?.messageEnabled ?? false,
      isNew: product?.isNew ?? false,
      heroFeatured: product?.heroFeatured ?? false,
      heroEnabled: true,
    },
    variants: (product?.variants ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      value: row.value ?? "",
      priceRupees: String(row.pricePaise / 100),
      isActive: row.isActive,
    })),
    flavours: (product?.flavours ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      surchargeRupees: row.surchargePaise === 0 ? "" : String(row.surchargePaise / 100),
      isActive: row.isActive,
    })),
    images: (product?.images ?? []).map((image) => ({
      id: image.id,
      altText: image.altText,
      isPrimary: image.isPrimary,
      removed: false,
    })),
    staged: [],
  };
}
