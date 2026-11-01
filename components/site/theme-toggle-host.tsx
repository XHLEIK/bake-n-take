import { cookies } from "next/headers";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

/**
 * Server wrapper for the theme toggle.
 *
 * The cookie value is rendered into the first paint, so the toggle never
 * flickers between icons while hydrating and "system" stays accurate.
 */
export async function ThemeToggleHost({ className }: { className?: string }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <ThemeToggle initialTheme={theme} className={className} />;
}
