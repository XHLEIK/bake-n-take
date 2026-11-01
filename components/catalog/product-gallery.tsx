"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "cn";

import type { Product } from "@/lib/catalog/types";
import { catalogAssetUrl } from "@/lib/catalog/repository";

/**
 * Product gallery: primary image large with selectable thumbnails.
 * Keyboard-operable buttons; the main image carries the alt text.
 */
export function ProductGallery({ product }: { product: Product }) {
  const [selected, setSelected] = useState(0);
  const images = product.images;
  const current = images[Math.min(selected, Math.max(images.length - 1, 0))];

  if (images.length === 0) {
    return (
      <div
        aria-label="No product images yet"
        className="grid aspect-[4/3] place-items-center rounded-2xl bg-muted/40 text-4xl font-semibold text-muted-foreground/60"
      >
        {product.name.slice(0, 1)}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted/40">
        {current ? (
          <Image
            key={current.id}
            src={catalogAssetUrl(current.storagePath) ?? ""}
            alt={current.altText || product.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="object-cover"
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`View image ${index + 1}`}
                aria-pressed={index === selected}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-xl bg-muted/40 ring-offset-2",
                  index === selected && "ring-2 ring-primary",
                )}
              >
                <Image
                  src={catalogAssetUrl(image.storagePath) ?? ""}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
