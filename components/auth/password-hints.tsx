"use client";

import { Check } from "lucide-react";
import { cn } from "cn";

/**
 * Live password checklist.
 *
 * Mirrors the server-side Zod rules exactly (lib/validation/auth.ts). Each
 * rule carries a text/`sr-only` state as well as an icon and colour, so the
 * requirement list is readable without relying on colour or shape alone. Met
 * rules check off in place; pending ones sit quietly beside them.
 */
const RULES = [
  { id: "length", label: "8+ characters", test: (value: string) => value.length >= 8 },
  { id: "letter", label: "One letter", test: (value: string) => /[A-Za-z]/.test(value) },
  { id: "number", label: "One number", test: (value: string) => /[0-9]/.test(value) },
] as const;

export function PasswordHints({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">Password requirements</p>
      <ul aria-live="polite" className="flex flex-wrap gap-1.5">
        {RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs transition-all duration-300",
                met ? "bg-sage/10 font-medium text-sage" : "text-muted-foreground",
              )}
            >
              {met ? (
                <Check aria-hidden="true" className="size-3.5 shrink-0" />
              ) : (
                <span
                  aria-hidden="true"
                  className="size-1 shrink-0 rounded-full bg-current opacity-60"
                />
              )}
              <span>{rule.label}</span>
              <span className="sr-only">{met ? " — met" : " — not met yet"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
