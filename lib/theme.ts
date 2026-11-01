/**
 * Theme preference model.
 *
 * The preference lives in a plain (non-HttpOnly) cookie so that:
 *  - the server can render the correct `class` on <html> for a hard-coded choice,
 *  - a tiny inline script can resolve "system" before the first paint (no flash).
 *
 * No theme library is required for two states plus "system".
 */

export const THEME_COOKIE = "bnt-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "system";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Normalises an untrusted cookie value into a known theme. */
export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

/** Cycle order used by the toggle: light -> dark -> system -> light. */
export function nextTheme(current: Theme): Theme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
}

/**
 * Class the server can apply immediately. "system" is intentionally left to the
 * inline script, because only the browser knows the OS preference.
 */
export function serverThemeClass(theme: Theme): "dark" | undefined {
  return theme === "dark" ? "dark" : undefined;
}

/**
 * Runs before paint in <head>. Keeps the <html> element in sync with the cookie
 * and, for "system", with the OS preference.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var name=${JSON.stringify(THEME_COOKIE)};
var match=document.cookie.match(new RegExp("(?:^|; )"+name+"=([^;]*)"));
var theme=match?decodeURIComponent(match[1]):"${DEFAULT_THEME}";
if(${JSON.stringify(THEMES)}.indexOf(theme)<0)theme="${DEFAULT_THEME}";
var query=window.matchMedia("(prefers-color-scheme: dark)");
function apply(){var dark=theme==="dark"||(theme==="system"&&query.matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.style.colorScheme=dark?"dark":"light";}
apply();
if(theme==="system"&&query.addEventListener)query.addEventListener("change",apply);
}catch(e){}})();`;
