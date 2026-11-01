"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Global error boundary.
 *
 * Deliberately shows nothing from `error.message`: server errors can contain
 * internals. The `digest` is a hash that support can correlate with server logs.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging already captured the detail; keep the client quiet.
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center sm:px-8">
      <span className="grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive">
        <CircleAlert aria-hidden="true" className="size-5" />
      </span>

      <div className="grid gap-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Something went wrong on our side
        </h1>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          Please try again. If it keeps happening, contact the bakery and we will sort it out.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
      </div>

      <Button type="button" onClick={reset} className="h-11 rounded-xl px-5 text-sm">
        Try again
      </Button>
    </main>
  );
}
