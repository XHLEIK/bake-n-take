"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, nextTheme, type Theme } from "@/lib/theme";

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;
const LABELS: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };

/**
 * Cycles light → dark → system.
 *
 * The server passes the cookie value in, so the first paint already shows the
 * right icon (no hydration guess). Applying a theme only touches the cookie and
 * the `<html>` classes — no re-render, no round trip, no flash.
 */
export function ThemeToggle({
  initialTheme,
  className,
}: {
  initialTheme: Theme;
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const apply = useCallback((value: Theme) => {
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = value === "dark" || (value === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, []);

  // Follow the operating system while "system" is selected.
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => apply("system");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme, apply]);

  const Icon = ICONS[theme];
  const upcoming = nextTheme(theme);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      onClick={() => {
        setTheme(upcoming);
        apply(upcoming);
      }}
      className={cn("size-10 rounded-xl", className)}
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[upcoming]}.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      <Icon aria-hidden="true" className="size-[1.05rem]" />
    </Button>
  );
}
