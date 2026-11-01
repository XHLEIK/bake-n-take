"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * About banner with a graceful fallback.
 *
 * The owner-selected image (custom upload or default choice) renders first;
 * if the underlying storage object is missing or deleted, the image swaps
 * to the first built-in banner instead of showing a broken-image icon. The
 * homepage can therefore never break on a stale banner reference.
 */
export function AboutBanner({
  src,
  alt,
  fallbackSrc,
}: {
  src: string;
  alt: string;
  fallbackSrc: string;
}) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  if (failed && fallbackFailed) return null;
  if (failed) {
    return (
      <Image
        src={fallbackSrc}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        onError={() => setFallbackFailed(true)}
        className="object-cover"
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 1024px) 100vw, 50vw"
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}
