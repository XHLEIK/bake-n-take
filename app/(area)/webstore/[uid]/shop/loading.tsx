/**
 * Bake list loading state.
 *
 * Skeleton mirrors the final layout shape (search field, category rail,
 * result header and product cards with the same aspect ratio) so streaming
 * in causes no layout shift. Respects `prefers-reduced-motion` via the
 * global reset.
 */
export default function ShopLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="surface-counter">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 pt-8 pb-7 sm:px-8 lg:pt-10">
          <div className="h-13 w-full animate-pulse rounded-2xl bg-muted/70" aria-hidden="true" />
          <div
            className="grid grid-cols-3 gap-1 rounded-2xl border border-border/70 bg-card/60 p-1"
            aria-hidden="true"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        </div>
      </div>
      <div
        aria-busy="true"
        aria-label="Loading bake list"
        className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-4 px-5 py-8 sm:px-8 lg:py-10"
      >
        <div className="grid gap-1" aria-hidden="true">
          <div className="h-6 w-40 animate-pulse rounded-lg bg-muted/70" />
          <div className="h-3 w-24 animate-pulse rounded-lg bg-muted/50" />
        </div>
        <ul
          aria-hidden="true"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,12.5rem),1fr))] sm:gap-5 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] xl:grid-cols-[repeat(auto-fill,minmax(min(100%,16.5rem),1fr))]"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="grid content-start gap-3">
              <div className="aspect-[5/4] animate-pulse rounded-3xl bg-muted/60" />
              <div className="h-4 w-3/4 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-3 w-1/2 animate-pulse rounded-lg bg-muted/40" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
