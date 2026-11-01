"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/auth/form-field";
import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { createPromotionAction, updatePromotionAction } from "@/lib/promotions/actions";
import type { Category } from "@/lib/catalog/types";
import type { OfferCatalogProduct } from "@/lib/promotions/repository";
import { BANNER_STYLES, PROMOTION_TYPES } from "@/lib/promotions/types";
import { OfferBanner } from "./offer-banner";
import type { BannerStyle, PromotionType } from "@/lib/promotions/types";
import type { OfferFormInitial } from "@/lib/promotions/form-defaults";

/**
 * Guided offer form (Phase 5).
 *
 * Only the fields relevant to the selected type render. Targeting checkboxes
 * serialize into hidden comma inputs (FormData.get reads a single value, so
 * checkbox groups cannot post directly). Title and description suggest
 * themselves from the offer setup until the owner types their own. The offer
 * name doubles as the banner header; the banner destination derives from
 * targeting. The banner preview updates live.
 */
type SuggestionInput = {
  type: PromotionType;
  percent: string;
  buyQty: string;
  rewardQty: string;
  rewardKind: string;
  rewardPercent: string;
  rewardPriceRupees: string;
  bundleQty: string;
  bundlePriceRupees: string;
  foKind: string;
  foValue: string;
  minOrderRupees: string;
  maxDiscountRupees: string;
};

/** Auto title/description for the banner, editable afterwards. */
function suggestBanner(values: SuggestionInput): { title: string; description: string } {
  const min =
    values.minOrderRupees.trim() && Number(values.minOrderRupees) > 0
      ? ` on orders over ₹${values.minOrderRupees.trim()}`
      : "";
  const max =
    values.maxDiscountRupees.trim() && Number(values.maxDiscountRupees) > 0
      ? ` (up to ₹${values.maxDiscountRupees.trim()} off)`
      : "";
  const whole = /^[0-9]+$/;
  switch (values.type) {
    case "percentage": {
      if (!whole.test(values.percent.trim())) return { title: "", description: "" };
      const p = values.percent.trim();
      return {
        title: `Get ${p}% OFF`,
        description: `Save ${p}% on eligible bakes${min}${max}.`,
      };
    }
    case "buy_x_get_y": {
      if (!whole.test(values.buyQty.trim()) || !whole.test(values.rewardQty.trim())) {
        return { title: "", description: "" };
      }
      const buy = values.buyQty.trim();
      const reward = values.rewardQty.trim();
      const what =
        values.rewardKind === "free"
          ? "FREE"
          : values.rewardKind === "percent"
            ? `${values.rewardPercent.trim()}% off`
            : `for ₹${values.rewardPriceRupees.trim()}`;
      return {
        title: `Buy ${buy}, Get ${reward} ${values.rewardKind === "free" ? "FREE" : what}`,
        description: `Add ${buy} eligible items and get ${reward} ${what.toLowerCase()}.`,
      };
    }
    case "mix_match": {
      if (!whole.test(values.bundleQty.trim()) || values.bundlePriceRupees.trim() === "") {
        return { title: "", description: "" };
      }
      const n = values.bundleQty.trim();
      const price = values.bundlePriceRupees.trim();
      return {
        title: `Any ${n} for ₹${price}`,
        description: `Mix and match any ${n} eligible treats for a flat ₹${price}.`,
      };
    }
    case "first_order": {
      if (values.foValue.trim() === "") return { title: "", description: "" };
      const value = values.foValue.trim();
      return values.foKind === "percent"
        ? {
            title: `${value}% OFF Your First Order`,
            description: `New here? Take ${value}% off your first order${max}.`,
          }
        : {
            title: `₹${value} OFF Your First Order`,
            description: `New here? Take ₹${value} off your first order.`,
          };
    }
  }
}

export function OfferForm({
  mode,
  initial,
  categories,
  products,
  gallery,
}: {
  mode: "create" | "edit";
  initial: OfferFormInitial;
  categories: Category[];
  products: OfferCatalogProduct[];
  gallery: { path: string; url: string }[];
}) {
  const [state, formAction] = useActionState(
    mode === "create" ? createPromotionAction : updatePromotionAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const [type, setType] = useState<PromotionType>(initial.type);
  const [rewardKind, setRewardKind] = useState(initial.rewardKind);
  const [foKind, setFoKind] = useState(initial.foKind);
  const [bannerStyle, setBannerStyle] = useState<BannerStyle>(initial.bannerStyle);
  const [galleryPath, setGalleryPath] = useState(initial.galleryImagePath);
  const [offerName, setOfferName] = useState(initial.name);
  const [autoApply, setAutoApply] = useState(initial.autoApply);

  // Discount setup (controlled for live title/description/coupon summaries).
  const [percent, setPercent] = useState(initial.percent);
  const [buyQty, setBuyQty] = useState(initial.buyQty);
  const [rewardQty, setRewardQty] = useState(initial.rewardQty);
  const [rewardPercent, setRewardPercent] = useState(initial.rewardPercent);
  const [rewardPriceRupees, setRewardPriceRupees] = useState(initial.rewardPriceRupees);
  const [bundleQty, setBundleQty] = useState(initial.bundleQty);
  const [bundlePriceRupees, setBundlePriceRupees] = useState(initial.bundlePriceRupees);
  const [foValue, setFoValue] = useState(initial.foValue);
  const [minOrderRupees, setMinOrderRupees] = useState(initial.minOrderRupees);
  const [maxDiscountRupees, setMaxDiscountRupees] = useState(initial.maxDiscountRupees);
  const [couponsText, setCouponsText] = useState(initial.couponsText);

  // Banner title/description suggest themselves until the owner types.
  const [banner, setBanner] = useState({
    title: initial.bannerTitle,
    description: initial.bannerDescription,
    cta: initial.bannerCtaLabel,
  });
  const [touchedTitle, setTouchedTitle] = useState(mode === "edit");
  const [touchedDesc, setTouchedDesc] = useState(mode === "edit");

  const suggestion = suggestBanner({
    type,
    percent,
    buyQty,
    rewardQty,
    rewardKind,
    rewardPercent,
    rewardPriceRupees,
    bundleQty,
    bundlePriceRupees,
    foKind,
    foValue,
    minOrderRupees,
    maxDiscountRupees,
  });
  const shownTitle = touchedTitle ? banner.title : suggestion.title;
  const shownDesc = touchedDesc ? banner.description : suggestion.description;

  /** Plain-language summary of what a coupon code unlocks. */
  function couponEffect(): string {
    const min =
      minOrderRupees.trim() && Number(minOrderRupees) > 0
        ? ` on orders over ₹${minOrderRupees.trim()}`
        : "";
    switch (type) {
      case "percentage":
        return `${percent.trim()}% off${min}.`;
      case "buy_x_get_y": {
        const reward =
          rewardKind === "free"
            ? "free"
            : rewardKind === "percent"
              ? `${rewardPercent.trim()}% off`
              : `for ₹${rewardPriceRupees.trim()}`;
        return `buy ${buyQty.trim()}, get ${rewardQty.trim()} ${reward}${min}.`;
      }
      case "mix_match":
        return `any ${bundleQty.trim()} for ₹${bundlePriceRupees.trim()}${min}.`;
      case "first_order":
        return foKind === "percent"
          ? `${foValue.trim()}% off the first order.`
          : `₹${foValue.trim()} off the first order.`;
    }
  }

  const [categoryIds, setCategoryIds] = useState<string[]>(initial.categoryIds);
  const [productIds, setProductIds] = useState<string[]>(initial.productIds);
  const [triggerCategoryIds, setTriggerCategoryIds] = useState<string[]>(
    initial.triggerCategoryIds,
  );
  const [triggerProductIds, setTriggerProductIds] = useState<string[]>(initial.triggerProductIds);
  const [rewardCategoryIds, setRewardCategoryIds] = useState<string[]>(initial.rewardCategoryIds);
  const [rewardProductIds, setRewardProductIds] = useState<string[]>(initial.rewardProductIds);

  function toggle(list: string[], set: (next: string[]) => void, id: string): void {
    set(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]);
  }

  const fieldError = (name: string): string | undefined => state.fieldErrors?.[name];
  const formError = state.status === "error" && state.message ? state.message : null;

  const check = "size-4 accent-current";

  return (
    <form action={formAction} className="grid gap-6">
      {mode === "edit" ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="categoryIds" value={categoryIds.join(",")} />
      <input type="hidden" name="productIds" value={productIds.join(",")} />
      <input type="hidden" name="triggerCategoryIds" value={triggerCategoryIds.join(",")} />
      <input type="hidden" name="triggerProductIds" value={triggerProductIds.join(",")} />
      <input type="hidden" name="rewardCategoryIds" value={rewardCategoryIds.join(",")} />
      <input type="hidden" name="rewardProductIds" value={rewardProductIds.join(",")} />
      <input type="hidden" name="galleryImagePath" value={galleryPath} />
      <input type="hidden" name="destType" value="store" />
      <input type="hidden" name="destCategoryId" value="" />
      <input type="hidden" name="destProductId" value="" />

      {formError ? <InlineMessage variant="error" message={formError} /> : null}
      {state.status === "success" && state.message ? (
        <InlineMessage variant="success" message={state.message} />
      ) : null}

      <section
        aria-label="Basics"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">Basics</h2>
        <FormField
          label="Offer name — also shown as the banner header"
          name="name"
          required
          maxLength={120}
          value={offerName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setOfferName(event.target.value)
          }
          error={fieldError("name")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium">
            Offer type
            <select
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as PromotionType)}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              {PROMOTION_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option === "percentage"
                    ? "Percentage off"
                    : option === "buy_x_get_y"
                      ? "Buy X Get Y"
                      : option === "mix_match"
                        ? "Mix & match (Any N for ₹X)"
                        : "First order"}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            Show order
            <select
              name="priority"
              defaultValue={initial.priority}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              <option value="high">Show first</option>
              <option value="normal">Normal</option>
              <option value="low">Show last</option>
            </select>
            <span className="font-normal text-muted-foreground">
              When several offers could apply, higher ones win ties. Normal is right for most
              offers.
            </span>
          </label>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-xs font-medium">How it applies</legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="autoApply"
              checked={autoApply && couponsText.trim() === ""}
              disabled={couponsText.trim() !== ""}
              onChange={(event) => setAutoApply(event.target.checked)}
              className={check}
            />
            <span className="grid gap-0.5">
              <span>Apply automatically</span>
              <span className="text-xs font-normal text-muted-foreground">
                {couponsText.trim() !== ""
                  ? "A coupon code below turns this off automatically."
                  : "Customers get this with no code. Uncheck to require a coupon code below."}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="isExclusive"
              defaultChecked={initial.isExclusive}
              className={check}
            />
            <span className="grid gap-0.5">
              <span>Only this offer</span>
              <span className="text-xs font-normal text-muted-foreground">
                Ignores every other discount on the order. Use rarely — for big sales.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="isStackable"
              defaultChecked={initial.isStackable}
              className={check}
            />
            <span className="grid gap-0.5">
              <span>Combine with other offers</span>
              <span className="text-xs font-normal text-muted-foreground">
                Adds this discount on top of other eligible offers.
              </span>
            </span>
          </label>
        </fieldset>
        {fieldError("autoApply") ? (
          <InlineMessage variant="error" message={fieldError("autoApply")!} />
        ) : null}
      </section>

      {type === "percentage" ? (
        <section
          aria-label="Discount"
          className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
        >
          <h2 className="font-heading text-base font-semibold">Discount</h2>
          <FormField
            label="Percent off (1–100)"
            name="percent"
            inputMode="numeric"
            required
            value={percent}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setPercent(event.target.value)
            }
            error={fieldError("percent")}
          />
        </section>
      ) : null}

      {type === "buy_x_get_y" ? (
        <section
          aria-label="Buy X Get Y"
          className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
        >
          <h2 className="font-heading text-base font-semibold">Buy X, get Y</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Buy quantity"
              name="buyQty"
              inputMode="numeric"
              required
              value={buyQty}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setBuyQty(event.target.value)
              }
              error={fieldError("buyQty")}
            />
            <FormField
              label="Reward quantity"
              name="rewardQty"
              inputMode="numeric"
              required
              value={rewardQty}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setRewardQty(event.target.value)
              }
              error={fieldError("rewardQty")}
            />
          </div>
          <label className="grid gap-1.5 text-xs font-medium">
            Reward kind
            <select
              name="rewardKind"
              value={rewardKind}
              onChange={(event) => setRewardKind(event.target.value as typeof rewardKind)}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              <option value="free">Free</option>
              <option value="percent">Percent off the reward</option>
              <option value="price">Fixed reward price</option>
            </select>
          </label>
          {rewardKind === "percent" ? (
            <FormField
              label="Reward percent (1–100)"
              name="rewardPercent"
              inputMode="numeric"
              required
              value={rewardPercent}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setRewardPercent(event.target.value)
              }
              error={fieldError("rewardPercent")}
            />
          ) : null}
          {rewardKind === "price" ? (
            <FormField
              label="Reward price (₹)"
              name="rewardPriceRupees"
              inputMode="decimal"
              required
              value={rewardPriceRupees}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setRewardPriceRupees(event.target.value)
              }
              error={fieldError("rewardPriceRupees")}
            />
          ) : null}
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="repeatable"
              defaultChecked={initial.repeatable}
              className={check}
            />
            <span className="grid gap-0.5">
              <span>Repeat for every qualifying set</span>
              <span className="text-xs font-normal text-muted-foreground">
                E.g. buy 4 with “buy 2 get 1” gives 2 rewards. Off applies it once per order.
              </span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Rewards go to the cheapest eligible units first. Empty trigger scope means the whole
            order; empty reward scope reuses the trigger scope.
          </p>
        </section>
      ) : null}

      {type === "mix_match" ? (
        <section
          aria-label="Mix and match"
          className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
        >
          <h2 className="font-heading text-base font-semibold">Bundle</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Bundle size (≥ 2)"
              name="bundleQty"
              inputMode="numeric"
              required
              value={bundleQty}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setBundleQty(event.target.value)
              }
              error={fieldError("bundleQty")}
            />
            <FormField
              label="Bundle price (₹)"
              name="bundlePriceRupees"
              inputMode="decimal"
              required
              value={bundlePriceRupees}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setBundlePriceRupees(event.target.value)
              }
              error={fieldError("bundlePriceRupees")}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="repeatable"
              defaultChecked={initial.repeatable}
              className={check}
            />
            <span className="grid gap-0.5">
              <span>Repeat for every full bundle</span>
              <span className="text-xs font-normal text-muted-foreground">
                E.g. 8 eligible treats with “any 4” forms two bundles. Off applies one bundle per
                order.
              </span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Bundles form from the cheapest eligible units first; leftover units stay full price.
          </p>
        </section>
      ) : null}

      {type === "first_order" ? (
        <section
          aria-label="First order"
          className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
        >
          <h2 className="font-heading text-base font-semibold">First-order reward</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-medium">
              Reward kind
              <select
                name="foKind"
                value={foKind}
                onChange={(event) => setFoKind(event.target.value as typeof foKind)}
                className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
              >
                <option value="fixed">Fixed ₹ off</option>
                <option value="percent">Percent off</option>
              </select>
            </label>
            <FormField
              label={foKind === "percent" ? "Percent (1–100)" : "Amount (₹)"}
              name="foValue"
              inputMode="decimal"
              required
              value={foValue}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setFoValue(event.target.value)
              }
              error={fieldError("foValue")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Eligibility is recorded permanently on first use — cancelling or deleting the order
            never restores it.
          </p>
        </section>
      ) : null}

      <section
        aria-label="Eligibility"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">Eligibility & limits</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <FormField
            label="Minimum order (₹)"
            name="minOrderRupees"
            inputMode="decimal"
            value={minOrderRupees}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setMinOrderRupees(event.target.value)
            }
            error={fieldError("minOrderRupees")}
          />
          <FormField
            label="Maximum discount (₹)"
            name="maxDiscountRupees"
            inputMode="decimal"
            value={maxDiscountRupees}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setMaxDiscountRupees(event.target.value)
            }
            error={fieldError("maxDiscountRupees")}
          />
          <FormField
            label="Total uses (blank = unlimited)"
            name="maxUsesGlobal"
            inputMode="numeric"
            defaultValue={initial.maxUsesGlobal}
            error={fieldError("maxUsesGlobal")}
          />
          <FormField
            label="Uses per customer (blank = unlimited)"
            name="maxUsesPerCustomer"
            inputMode="numeric"
            defaultValue={initial.maxUsesPerCustomer}
            error={fieldError("maxUsesPerCustomer")}
          />
        </div>
      </section>

      <section
        aria-label="Targeting"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">
          {type === "buy_x_get_y" ? "Trigger & reward products" : "Eligible products"}
        </h2>
        {type === "buy_x_get_y" ? (
          <>
            <TargetGroup
              title="Trigger — what the customer buys"
              categories={categories}
              products={products}
              categoryIds={triggerCategoryIds}
              productIds={triggerProductIds}
              onToggleCategory={(id) => toggle(triggerCategoryIds, setTriggerCategoryIds, id)}
              onToggleProduct={(id) => toggle(triggerProductIds, setTriggerProductIds, id)}
            />
            <TargetGroup
              title="Reward — what gets discounted"
              categories={categories}
              products={products}
              categoryIds={rewardCategoryIds}
              productIds={rewardProductIds}
              onToggleCategory={(id) => toggle(rewardCategoryIds, setRewardCategoryIds, id)}
              onToggleProduct={(id) => toggle(rewardProductIds, setRewardProductIds, id)}
            />
          </>
        ) : (
          <TargetGroup
            title="Categories & products (empty = whole store)"
            categories={categories}
            products={products}
            categoryIds={categoryIds}
            productIds={productIds}
            onToggleCategory={(id) => toggle(categoryIds, setCategoryIds, id)}
            onToggleProduct={(id) => toggle(productIds, setProductIds, id)}
          />
        )}
      </section>

      <section
        aria-label="Coupon code"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">Coupon code</h2>
        <p className="text-xs text-muted-foreground">
          Optional. When a code is set, this offer applies by code only — automatic application
          turns off by itself.
        </p>
        <label className="grid gap-1.5 text-xs font-medium">
          Code (4–24 letters/digits, one per line)
          <textarea
            name="couponsText"
            rows={2}
            value={couponsText}
            onChange={(event) => setCouponsText(event.target.value)}
            placeholder={"SUMMER50"}
            className="rounded-xl border border-input bg-card px-3 py-2.5 font-mono text-sm font-normal uppercase placeholder:normal-case"
          />
        </label>
        {fieldError("couponsText") ? (
          <InlineMessage variant="error" message={fieldError("couponsText")!} />
        ) : null}
        {couponsText.trim() !== "" ? (
          <p role="status" className="rounded-xl bg-primary/10 px-3 py-2.5 text-xs font-medium">
            Code{couponsText.trim().includes("\n") ? "s" : ""}{" "}
            {couponsText
              .split("\n")
              .map((line) => line.trim().toUpperCase())
              .filter(Boolean)
              .join(", ")}{" "}
            will give customers: {couponEffect()}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Leave empty and the offer applies automatically at checkout.
          </p>
        )}
        <p className="text-xs text-muted-foreground">Codes are never listed publicly.</p>
      </section>

      <section
        aria-label="Banner"
        className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
      >
        <h2 className="font-heading text-base font-semibold">Customer banner</h2>
        <p className="text-xs text-muted-foreground">
          The offer name above appears as the banner header. The title and description suggest
          themselves — edit them to write your own.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Button label"
            name="bannerCtaLabel"
            maxLength={40}
            defaultValue={initial.bannerCtaLabel}
            error={fieldError("bannerCtaLabel")}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setBanner((b) => ({ ...b, cta: event.target.value }))
            }
          />
          <label className="grid gap-1.5 text-xs font-medium">
            Predefined style
            <select
              name="bannerStyle"
              value={bannerStyle}
              onChange={(event) => setBannerStyle(event.target.value as BannerStyle)}
              className="h-10 rounded-xl border border-input bg-card px-2 text-sm font-normal"
            >
              {BANNER_STYLES.map((option) => (
                <option key={option} value={option}>
                  {option[0].toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            Banner image (PNG/JPEG/WebP, ≤ 2 MB)
            <input
              type="file"
              name="bannerImage"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm font-normal file:mr-3 file:h-10 file:rounded-xl file:border-0 file:bg-secondary file:px-4 file:text-sm file:font-medium"
            />
          </label>
        </div>
        <FormField
          label="Title"
          name="bannerTitle"
          maxLength={120}
          value={shownTitle}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setTouchedTitle(true);
            setBanner((b) => ({ ...b, title: event.target.value }));
          }}
          error={fieldError("bannerTitle")}
        />
        <label className="grid gap-1.5 text-xs font-medium">
          Description
          <textarea
            name="bannerDescription"
            rows={2}
            maxLength={500}
            value={shownDesc}
            onChange={(event) => {
              setTouchedDesc(true);
              setBanner((b) => ({ ...b, description: event.target.value }));
            }}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-normal"
          />
        </label>
        {initial.bannerImageUrl ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="removeBannerImage" className="size-4 accent-current" />
            Remove the current banner image
          </label>
        ) : null}
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
        <div className="grid gap-1.5">
          <p className="text-xs font-medium">Live preview</p>
          <OfferBanner
            header={offerName.trim() || "Your offer name"}
            title={shownTitle || "Your offer title"}
            description={shownDesc}
            ctaLabel={banner.cta}
            style={bannerStyle}
            imageUrl={
              gallery.find((entry) => entry.path === galleryPath)?.url ?? initial.bannerImageUrl
            }
          />
        </div>
      </section>

      <div className="sticky bottom-4 flex gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <SubmitButton pendingLabel={mode === "create" ? "Creating…" : "Saving…"}>
          {mode === "create" ? "Create offer" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}

function TargetGroup({
  title,
  categories,
  products,
  categoryIds,
  productIds,
  onToggleCategory,
  onToggleProduct,
}: {
  title: string;
  categories: Category[];
  products: OfferCatalogProduct[];
  categoryIds: string[];
  productIds: string[];
  onToggleCategory: (id: string) => void;
  onToggleProduct: (id: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-medium">{title}</legend>
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs has-checked:border-primary has-checked:bg-primary/10"
            >
              <input
                type="checkbox"
                checked={categoryIds.includes(category.id)}
                onChange={() => onToggleCategory(category.id)}
                className="size-3.5 accent-current"
              />
              {category.name}
            </label>
          ))}
        </div>
      ) : null}
      <div className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-border p-2">
        {products.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No products yet.</p>
        ) : (
          products.map((product) => (
            <label
              key={product.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={productIds.includes(product.id)}
                onChange={() => onToggleProduct(product.id)}
                className="size-3.5 accent-current"
              />
              {product.name}
            </label>
          ))
        )}
      </div>
    </fieldset>
  );
}
