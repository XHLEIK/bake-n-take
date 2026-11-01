/** Warm skeleton shown while the webstore streams in. */
export default function WebstoreLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the bakery"
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-14 px-5 py-8 sm:px-8 lg:gap-20 lg:py-12"
    >
      <div className="aspect-[4/5] animate-pulse rounded-[2rem] bg-muted/70 sm:aspect-[21/9]" />
      <div className="grid gap-5">
        <div className="h-7 w-48 animate-pulse rounded-xl bg-muted/70" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-3xl bg-muted/50" />
          ))}
        </div>
      </div>
      <div className="grid gap-5">
        <div className="h-7 w-56 animate-pulse rounded-xl bg-muted/70" />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="grid gap-3">
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
