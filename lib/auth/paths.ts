import { dashboardPathForRole, type Role } from "./roles";

/**
 * Route constants and redirect-target hardening.
 *
 * Every route a user can be redirected to after authentication is resolved
 * through this module so that a `?next=` value can never turn into an open
 * redirect (or an authorization shortcut).
 */

export const AUTH_ROUTES = {
  login: "/login",
  signup: "/signup",
  ownerLogin: "/owner/login",
  forgotPassword: "/forgot-password",
  updatePassword: "/update-password",
  callback: "/auth/callback",
} as const;

export const CUSTOMER_HOME = "/customer";
export const OWNER_HOME = "/owner";

/**
 * Prefix of the per-account customer area (`/webstore/[uid]`).
 *
 * The `[uid]` segment is verified against the session on every page — see
 * `redirectIfUidMismatch` in `./session` — so listing the prefix here only
 * decides the *optimistic* proxy behaviour (send anonymous visitors to
 * `/login`), never authorization.
 */
export const WEBSTORE_HOME = "/webstore";

const MAX_PATH_LENGTH = 512;

function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** True when the value is a same-origin absolute path (never a scheme or host). */
export function isLocalPath(value: string): boolean {
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  if (value.includes("\\")) return false;
  // Control characters (CR/LF, NUL) have no business in a redirect target.

  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
}

/**
 * Normalises an untrusted `next` value (query string or form field) into a safe
 * local path. Anything suspicious — absolute URLs, protocol-relative URLs,
 * backslash tricks, encoded variants, CRLF — falls back to `fallback`.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return fallback;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;

  const decoded = decodeOnce(trimmed);
  if (decoded === null) return fallback;

  return isLocalPath(decoded) ? decoded : fallback;
}

/** Paths that always require an authenticated session. */
export function isProtectedPath(pathname: string): boolean {
  // The owner sign-in screen lives under /owner but must stay public.
  if (pathname === AUTH_ROUTES.ownerLogin || pathname.startsWith(`${AUTH_ROUTES.ownerLogin}/`)) {
    return false;
  }

  return (
    pathname === CUSTOMER_HOME ||
    pathname.startsWith(`${CUSTOMER_HOME}/`) ||
    pathname === OWNER_HOME ||
    pathname.startsWith(`${OWNER_HOME}/`) ||
    pathname === WEBSTORE_HOME ||
    pathname.startsWith(`${WEBSTORE_HOME}/`)
  );
}

/** Appends query parameters, skipping empty values. */
export function pathWithParams(
  pathname: string,
  params: Record<string, string | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Owner routes use a separate sign-in screen; everything else uses /login. */
export function loginPathFor(pathname: string): string {
  return pathname === OWNER_HOME || pathname.startsWith(`${OWNER_HOME}/`)
    ? AUTH_ROUTES.ownerLogin
    : AUTH_ROUTES.login;
}

/**
 * Post-authentication destination.
 *
 * `next` is only honoured when it points at a protected route inside the
 * caller's own area; everything else falls back to the role's home page. A
 * customer therefore cannot use `?next=/owner` to influence navigation.
 * A `next` that names another account's `[uid]` is passed through here but
 * rejected at the page itself (`redirectIfUidMismatch`), which bounces the
 * visitor to their own URL.
 */
export function destinationForRole(role: Role, next: unknown, userId: string): string {
  const fallback = dashboardPathForRole(role, userId);
  const target = safeNextPath(next, "");
  if (!isProtectedPath(target)) return fallback;

  const inOwnerArea = target === OWNER_HOME || target.startsWith(`${OWNER_HOME}/`);
  const belongsToRole = inOwnerArea === (role === "OWNER");
  return belongsToRole ? target : fallback;
}
