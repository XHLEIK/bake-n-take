"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

function subscribe() {
  return () => {};
}

/**
 * Viewport-anchored overlay portal.
 *
 * `position: fixed` is unreliable inside the sticky site header because its
 * backdrop blur creates a containing block — a `fixed inset-0` overlay
 * would size against the 64px header instead of the viewport (clipped
 * drawer, header-sized scrim). Portaling to `document.body` keeps overlays
 * truly viewport-relative. The server snapshot renders null so server HTML
 * and the first client render match exactly (no hydration mismatch).
 */
export function OverlayPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
