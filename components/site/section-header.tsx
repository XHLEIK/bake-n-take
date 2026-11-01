import { cn } from "cn";

/**
 * Shared section header for the storefront.
 *
 * One typographic system for every homepage/shop section: an optional
 * eyebrow, a display title (serif for editorial warmth at large sizes) and
 * a supporting action link aligned on the baseline.
 */
export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  /** Rendered on the right on desktop (a Link or any small element). */
  action?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="grid gap-1.5">
        {eyebrow ? (
          <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-primary/90 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Tag
          className={cn(
            "font-heading font-semibold tracking-tight text-balance",
            Tag === "h2" ? "text-2xl sm:text-[1.75rem]" : "text-xl",
          )}
        >
          {title}
        </Tag>
      </div>
      {action ? <div className="pb-1 text-sm">{action}</div> : null}
    </div>
  );
}
