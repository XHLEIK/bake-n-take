/**
 * Customer storefront ambience.
 *
 * The same warm film grain the auth pages use (same `brand-grain` token, lower
 * opacity for long scrolling pages) over the global `brand-canvas` backdrop.
 * Rendered per customer brand page — never in the shared area layout, so the
 * owner console is visually untouched. Fixed, pointer-events-free, and
 * paint-cheap: reduced-motion and theme blending live in the shared CSS.
 */
export function StorefrontAmbient() {
  return (
    <div
      aria-hidden="true"
      className="brand-grain pointer-events-none fixed inset-0 z-0 opacity-25 mix-blend-soft-light"
    />
  );
}
