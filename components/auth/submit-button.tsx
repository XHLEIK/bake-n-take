"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

/**
 * Submit button that reports the enclosing form's pending state.
 *
 * A brand-material pill: gradient fill with an inner highlight, a sheen that
 * sweeps across on hover (pure transform, no repaint), and tactile press
 * feedback. Prevents duplicate submissions while the server action runs and
 * announces the busy state to assistive technology.
 */
export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "brand-surface relative h-[var(--auth-submit-h,3.25rem)] w-full overflow-hidden rounded-2xl text-[15px] font-semibold tracking-wide transition-all duration-200 active:scale-[0.985]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 -left-3/4 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent transition-[transform,left] duration-700 ease-out group-hover/button:translate-x-[280%]"
      />
      <span className="relative inline-flex items-center gap-2">
        {pending ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {pendingLabel}
          </>
        ) : (
          children
        )}
      </span>
    </Button>
  );
}
