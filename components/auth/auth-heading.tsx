import { cn } from "cn";

/**
 * Shared heading block for authentication screens.
 * Keeps every page's hierarchy identical (h1 + supporting copy) for both
 * assistive technology and visual rhythm. The title size follows the
 * shell's `--auth-title` variable so every auth page fits its viewport
 * without scrolling, at any desktop height.
 */
export function AuthHeading({
  eyebrow,
  title,
  description,
  className,
  descriptionClassName,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  descriptionClassName?: string;
}) {
  return (
    <header className={cn("grid gap-2.5", className)}>
      {eyebrow ? (
        <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-primary/90 uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-serif text-[var(--auth-title,2rem)] leading-[1.12] font-medium tracking-[-0.01em] text-balance">
        {title}
      </h1>
      {description ? (
        <p
          className={cn(
            "max-w-[36ch] text-[length:var(--auth-desc,0.875rem)] leading-relaxed text-pretty text-muted-foreground sm:max-w-none",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
