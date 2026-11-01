"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { FormField, type FormFieldProps } from "./form-field";

/**
 * Password input with a visibility toggle.
 *
 * The toggle is a real button (keyboard reachable, `aria-pressed` + descriptive
 * label) so typing a long password on a phone is not a blind exercise.
 */
export function PasswordField({
  label = "Password",
  error,
  hint,
  ...props
}: Omit<FormFieldProps, "type" | "icon" | "trailing">) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      icon={<Lock className="size-4" />}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      }
      {...props}
    />
  );
}
