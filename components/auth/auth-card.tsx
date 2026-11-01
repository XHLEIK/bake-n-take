import { cn } from "cn";

/**
 * Soft panel for auth content.
 *
 * A frosted card that floats above the ambient canvas: translucent surface,
 * 1px inner highlight for the glass edge, warm tinted shadow beneath, and a
 * whisper of caramel glow behind it. Footnotes and cross-links live outside
 * the panel, below it.
 */
export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-5 -z-10 rounded-[2.75rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_11%,transparent),transparent)] blur-md"
      />
      <div
        className={cn(
          "relative grid gap-6 rounded-[2rem] border border-border/50 bg-card/75 p-6 backdrop-blur-xl sm:p-8",
          "lg:max-h-full lg:gap-[var(--auth-gap,1.25rem)] lg:overflow-y-auto lg:p-[var(--auth-card-pad,2rem)] lg:[scrollbar-width:none]",
          "shadow-[0_1px_0_rgb(255_255_255/0.55)_inset,0_40px_80px_-42px_rgb(66_40_16/0.4)]",
          "dark:border-white/10 dark:shadow-[0_1px_0_rgb(255_255_255/0.06)_inset,0_40px_80px_-42px_rgb(0_0_0/0.7)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
