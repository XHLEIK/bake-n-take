import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "cn";

/**
 * Inline status message for forms.
 *
 * Errors use `role="alert"` (assertive), successes and neutrals use
 * `role="status"` (polite), so screen readers announce changes without
 * interrupting. Messages always pair an icon and text with the colour.
 */
export function InlineMessage({
  variant,
  message,
  className,
}: {
  variant: "error" | "success" | "info";
  message: string;
  className?: string;
}) {
  const Icon = variant === "error" ? CircleAlert : variant === "success" ? CircleCheck : Info;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "animate-rise-soft flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        variant === "error" &&
          "border-destructive/25 bg-destructive/8 text-destructive shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--destructive)_70%,transparent)]",
        variant === "success" &&
          "border-sage/35 bg-sage/10 text-sage shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--sage)_70%,transparent)]",
        variant === "info" &&
          "border-border/80 bg-muted/50 text-foreground shadow-[0_10px_24px_-18px_rgb(66_40_16/0.35)]",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="text-pretty leading-relaxed">{message}</p>
    </div>
  );
}
