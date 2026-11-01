import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FormFieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  /** Server-side validation message for this field. */
  error?: string;
  hint?: string;
  icon?: ReactNode;
  /** Optional control rendered inside the field, on the right (for example, a visibility toggle). */
  trailing?: ReactNode;
};

/**
 * Labelled text field with accessible error wiring:
 *  - the label is always associated with the control,
 *  - errors are linked with `aria-describedby` and marked with `aria-invalid`
 *    (colour is never the only signal),
 *  - 44px touch target and 16px type so mobile browsers do not zoom on focus.
 */
export function FormField({
  label,
  name,
  error,
  hint,
  icon,
  trailing,
  className,
  ...props
}: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={name} className="text-[0.8125rem] font-medium tracking-wide">
        {label}
      </Label>

      <div className="group relative">
        {icon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 grid size-5 -translate-y-1/2 place-items-center rounded-md bg-muted text-muted-foreground transition-colors duration-200 group-focus-within:bg-primary/12 group-focus-within:text-primary"
          >
            {icon}
          </span>
        ) : null}
        <Input
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            "h-[var(--auth-input-h,3.25rem)] rounded-2xl border-border/70 bg-card/60 px-4 text-base shadow-[0_1px_2px_rgb(66_40_16/0.06)] transition-all duration-200 focus-visible:border-primary/50 focus-visible:bg-card focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_10%,transparent)] md:text-base",
            icon ? "pl-11" : undefined,
            trailing ? "pr-12" : undefined,
            className,
          )}
          {...props}
        />
        {trailing ? (
          <span className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</span>
        ) : null}
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="animate-rise-soft text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
