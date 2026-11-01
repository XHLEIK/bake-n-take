"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Minus, Plus, ShoppingBag, Trash2, Zap } from "lucide-react";

import { InlineMessage } from "@/components/auth/inline-message";
import { removeCustomerDesignAction, uploadCustomerDesignAction } from "@/lib/catalog/actions";
import { configurationTotalPaise } from "@/lib/catalog/pricing";
import type { Product } from "@/lib/catalog/types";
import { addToCartAction } from "@/lib/orders/actions";
import {
  earliestPickupAt,
  formatPickupAt,
  pickupDayOptions,
  pickupTimeSlots,
  pickupToIso,
} from "@/lib/orders/pickup";
import { PickupSelector } from "@/components/orders/pickup-selector";
import { formatPaise } from "@/lib/store/format";
import type { WeekHours } from "@/lib/store/types";
import { INITIAL_DESIGN_UPLOAD_STATE, type DesignUploadState } from "@/lib/catalog/types";

/**
 * Product configurator (Phase 4).
 *
 * Variant, flavour, egg choice, message, quantity and custom-design pickers
 * with a live total computed from database prices via
 * `configurationTotalPaise`. The total is a preview only — the server
 * re-prices everything at checkout. Save to Cart persists the configuration;
 * Order Now jumps straight to checkout with just this line.
 */
export function Configurator({
  product,
  money,
  webstoreUid,
  hours,
}: {
  product: Product;
  money: { currency: string; currencySymbol: string };
  webstoreUid: string;
  hours: WeekHours | null;
}) {
  const router = useRouter();
  const activeVariants = useMemo(
    () => product.variants.filter((variant) => variant.isActive),
    [product.variants],
  );
  const activeFlavours = useMemo(
    () => product.flavours.filter((flavour) => flavour.isActive),
    [product.flavours],
  );

  const [variantId, setVariantId] = useState<string | null>(
    activeVariants.length > 0 ? activeVariants[0].id : null,
  );
  const [flavourId, setFlavourId] = useState<string | null>(
    activeFlavours.length > 0 ? activeFlavours[0].id : null,
  );
  const [eggless, setEggless] = useState(false);
  const [message, setMessage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [designPath, setDesignPath] = useState<string | null>(null);
  // Preselect the earliest valid slot so the requirement is visible, not
  // hidden: the customer always sees (and can change) a real pickup time.
  const [pickupAt, setPickupAt] = useState<string | null>(() => {
    const now = Date.now();
    const firstDay = pickupDayOptions(now, product.minPrepMinutes, hours)[0];
    if (!firstDay) return null;
    const firstSlot = pickupTimeSlots(firstDay.dateStr, now, product.minPrepMinutes, hours).find(
      (slot) => !slot.disabled,
    );
    return firstSlot ? pickupToIso(firstDay.dateStr, firstSlot.timeStr) : null;
  });
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartBusy, setCartBusy] = useState<"cart" | "now" | null>(null);
  // Sticky mobile bar: visible only while the inline actions are scrolled
  // out of view and the footer is not — so it never covers content, the
  // footer, or (z-20 under the z-30 header) an open notification panel.
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    // jsdom (unit tests) has no IntersectionObserver — the bar simply stays
    // hidden there; browsers take the observed path below.
    if (typeof IntersectionObserver === "undefined") return;
    const cta = ctaRef.current;
    if (!cta) return;
    const ctaObserver = new IntersectionObserver(
      ([entry]) => setCtaVisible(entry?.isIntersecting ?? true),
      { threshold: 0 },
    );
    ctaObserver.observe(cta);
    const footer = document.querySelector("footer");
    const footerObserver = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry?.isIntersecting ?? false),
      { threshold: 0 },
    );
    if (footer) footerObserver.observe(footer);
    return () => {
      ctaObserver.disconnect();
      footerObserver.disconnect();
    };
  }, []);
  // Mount-time clock for the pickup grid: stable across re-renders so slots
  // never shift while the customer is choosing. Freshness is re-checked with
  // a live clock at submit, and the server enforces the rule again.
  const [nowMs] = useState(() => Date.now());

  const variant = activeVariants.find((row) => row.id === variantId) ?? null;
  const flavour = activeFlavours.find((row) => row.id === flavourId) ?? null;

  const totalPaise = configurationTotalPaise(product.basePricePaise, {
    variantPaise: variant ? variant.pricePaise : null,
    flavourSurchargePaise: flavour ? flavour.surchargePaise : 0,
    egglessSelected: product.eggEgglessEnabled && eggless,
    egglessSurchargePaise: product.egglessSurchargePaise,
  });

  async function submit(destination: "cart" | "now") {
    if (!product.isActive) return;
    setCartError(null);
    // Freshness re-check: a page left open for hours must not submit the
    // slot it rendered with. The server enforces the same rule again.
    if (
      !pickupAt ||
      Number.isNaN(Date.parse(pickupAt)) ||
      Date.parse(pickupAt) < earliestPickupAt(Date.now(), product.minPrepMinutes)
    ) {
      setCartError("That pickup time has passed — please pick a later slot.");
      return;
    }
    setCartBusy(destination);
    try {
      const result = await addToCartAction({
        productId: product.id,
        variantId,
        flavourId,
        eggEggless: product.eggEgglessEnabled ? (eggless ? "eggless" : "egg") : "",
        message: product.messageEnabled ? message.trim() : "",
        designPath: product.allowCustomDesign ? (designPath ?? "") : "",
        pickupAt,
        quantity,
      });
      if (result.status !== "success") {
        setCartError(result.message ?? "We could not update your cart.");
        return;
      }
      if (destination === "now" && result.cartItemId) {
        router.push(`/webstore/${webstoreUid}/checkout?items=${result.cartItemId}`);
      } else {
        router.push(`/webstore/${webstoreUid}/cart`);
      }
    } finally {
      setCartBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      {activeVariants.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="pb-2 text-sm font-medium">
            {product.variantMode === "quantity" ? "Choose pack" : "Size"}
          </legend>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label={product.variantMode === "quantity" ? "Pack options" : "Size options"}
          >
            {" "}
            {activeVariants.map((row) => {
              const selected = row.id === variant?.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setVariantId(row.id)}
                  className={`grid min-h-11 min-w-20 place-items-center gap-0.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span>{row.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatPaise(row.pricePaise, money)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {activeFlavours.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="pb-2 text-sm font-medium">Flavour</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Flavours">
            {activeFlavours.map((row) => {
              const selected = row.id === flavour?.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFlavourId(row.id)}
                  className={`min-h-11 rounded-xl border px-3.5 text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  {row.name}
                  {row.surchargePaise > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      +{formatPaise(row.surchargePaise, money)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground"> · Included</span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {product.eggEgglessEnabled ? (
        <fieldset className="grid gap-2">
          <legend className="pb-2 text-sm font-medium">Egg preference</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Egg preference">
            {(
              [
                { value: false, label: "Egg" },
                {
                  value: true,
                  label:
                    product.egglessSurchargePaise > 0
                      ? `Eggless (+${formatPaise(product.egglessSurchargePaise, money)})`
                      : "Eggless",
                },
              ] as const
            ).map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={eggless === option.value}
                onClick={() => setEggless(option.value)}
                className={`min-h-11 rounded-xl border px-3.5 text-sm transition-colors ${
                  eggless === option.value
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {product.messageEnabled ? (
        <div className="grid gap-2">
          <label htmlFor="cake-message" className="text-sm font-medium">
            Cake message <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="cake-message"
            name="cakeMessage"
            maxLength={60}
            placeholder="e.g. Happy Birthday, Aarav!"
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
            className="h-11 rounded-xl border border-input bg-card/70 px-3 text-sm shadow-xs"
          />
        </div>
      ) : null}

      {product.allowCustomDesign ? (
        <DesignUpload
          path={designPath}
          onUploaded={setDesignPath}
          onRemoved={() => setDesignPath(null)}
        />
      ) : null}

      <PickupSelector
        minPrepMinutes={product.minPrepMinutes}
        hours={hours}
        nowMs={nowMs}
        value={pickupAt}
        onChange={setPickupAt}
      />

      <div className="grid gap-2">
        <span id="config-quantity-label" className="text-sm font-medium">
          Order quantity
        </span>
        <div
          className="flex items-center gap-3"
          role="group"
          aria-labelledby="config-quantity-label"
        >
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="grid size-11 place-items-center rounded-xl border border-border hover:border-primary/40 disabled:opacity-40"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <span aria-live="polite" className="min-w-8 text-center text-sm font-semibold">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(99, value + 1))}
            disabled={quantity >= 99}
            aria-label="Increase quantity"
            className="grid size-11 place-items-center rounded-xl border border-border hover:border-primary/40 disabled:opacity-40"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <div
        aria-live="polite"
        className="grid gap-1 rounded-2xl border border-border/60 bg-card/80 px-4 py-3.5 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset] dark:border-white/10 dark:shadow-none"
      >
        <p className="text-sm text-muted-foreground">
          {[
            variant?.label,
            flavour?.name,
            product.eggEgglessEnabled ? (eggless ? "Eggless" : "Egg") : null,
            quantity > 1 ? `× ${quantity}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Standard"}
        </p>
        {formatPickupAt(pickupAt) ? (
          <p className="text-xs text-muted-foreground">Pickup: {formatPickupAt(pickupAt)}</p>
        ) : null}
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Total</span>
          <span className="font-heading text-2xl font-semibold">
            {formatPaise(totalPaise * quantity, money)}
          </span>
        </p>
      </div>

      {cartError ? <InlineMessage variant="error" message={cartError} /> : null}

      {product.isActive ? (
        <>
          <div ref={ctaRef} className="grid scroll-mt-24 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={cartBusy !== null}
              onClick={() => void submit("cart")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              <ShoppingBag aria-hidden="true" className="size-4" />
              {cartBusy === "cart" ? "Adding…" : "Save to Cart"}
            </button>
            <button
              type="button"
              disabled={cartBusy !== null}
              onClick={() => void submit("now")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Zap aria-hidden="true" className="size-4" />
              {cartBusy === "now" ? "Preparing…" : "Order Now"}
            </button>
          </div>
          {!ctaVisible && !footerVisible ? (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-card/95 backdrop-blur-xl sm:hidden">
              <div
                className="flex items-center justify-between gap-3 px-4 pt-3"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <p className="grid">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="font-heading text-lg leading-tight font-semibold">
                    {formatPaise(totalPaise * quantity, money)}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={cartBusy !== null}
                  onClick={() => void submit("now")}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Zap aria-hidden="true" className="size-4" />
                  {cartBusy === "now" ? "Preparing…" : "Order Now"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
          This product is currently unavailable — browse the bake list for alternatives.
        </p>
      )}
    </div>
  );
}

/**
 * Customer design staging (controlled).
 *
 * Uploads to the private bucket as the caller's own draft, previews locally,
 * and can be removed before proceeding. The parent keeps the storage path for
 * Save to Cart / Order Now. Nothing is ordered by uploading.
 */
function DesignUpload({
  path,
  onUploaded,
  onRemoved,
}: {
  path: string | null;
  onUploaded: (path: string) => void;
  onRemoved: () => void;
}) {
  const [upload, setUpload] = useState<DesignUploadState>(INITIAL_DESIGN_UPLOAD_STATE);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(file: File) {
    setBusy(true);
    const body = new FormData();
    body.set("design", file);
    setPreview(URL.createObjectURL(file));
    const result = await uploadCustomerDesignAction(INITIAL_DESIGN_UPLOAD_STATE, body);
    setUpload(result);
    setBusy(false);
    if (result.status === "success" && result.path) onUploaded(result.path);
  }

  async function remove() {
    if (!path) return;
    setBusy(true);
    const result = await removeCustomerDesignAction(path);
    setBusy(false);
    if (result.status === "success") {
      setPreview(null);
      setUpload(INITIAL_DESIGN_UPLOAD_STATE);
      onRemoved();
    } else {
      setUpload(result);
    }
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-dashed border-border/80 bg-card/40 p-4">
      <p className="text-sm font-medium">Custom design</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Upload reference art for this product. It stays a private draft — nothing is ordered yet.
      </p>

      {path ? (
        <div className="grid gap-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Your design preview"
              className="max-h-48 rounded-xl object-contain"
            />
          ) : null}
          <p role="status" className="text-xs text-muted-foreground">
            Design attached for your future order.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            {busy ? "Removing…" : "Remove design"}
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {upload.status === "error" && upload.message ? (
            <InlineMessage variant="error" message={upload.message} />
          ) : null}
          <label
            htmlFor="customer-design"
            className="inline-flex h-11 w-fit cursor-pointer items-center gap-1.5 rounded-xl bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            {busy ? "Uploading…" : "Choose image"}
          </label>
          <input
            id="customer-design"
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            disabled={busy}
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void submit(file);
            }}
          />
          <p className="text-xs text-muted-foreground">PNG, JPEG or WebP up to 5 MB.</p>
        </div>
      )}
    </div>
  );
}
