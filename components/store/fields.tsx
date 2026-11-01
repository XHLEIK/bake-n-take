"use client";

import { cn } from "cn";

import { FormField } from "@/components/auth/form-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/**
 * Small field kit for the Store Settings console.
 *
 * Visual language matches the auth FormField (44px targets, 16px type,
 * error-below-input, colour-never-the-only-signal) so the owner console feels
 * like the same product. Switches and textareas do not exist in the shared
 * ui/ set, so they live here instead of pulling a new dependency.
 */

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  );
}

export function SettingsTextArea({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  rows = 3,
  maxLength,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={name} className="text-[0.8125rem]">
        {label}
      </Label>
      <textarea
        id={name}
        name={name}
        value={value}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-11 rounded-xl border border-input bg-card/70 px-3 py-2.5 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsSwitch({
  label,
  description,
  name,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1 left-1 size-5 rounded-full bg-card shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
      <input type="hidden" name={name} value={checked ? "1" : "0"} />
    </div>
  );
}

export { FormField };
