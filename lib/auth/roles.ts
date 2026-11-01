/**
 * Application role model.
 *
 * Mirrors the `public.user_role` / `public.account_status` enums created in
 * `supabase/migrations/`. Postgres RLS is the authorization boundary; these
 * helpers only shape the data the server has already been allowed to read.
 */

export const ROLES = ["CUSTOMER", "OWNER"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** The bakery's application-level user. Never contains credentials. */
export type Profile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  status: AccountStatus;
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === "string" && (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

/** Unknown or missing roles fail closed: they are never treated as owner. */
export function isOwner(profile: Pick<Profile, "role"> | null | undefined): boolean {
  return profile?.role === "OWNER";
}

export function isActive(profile: Pick<Profile, "status"> | null | undefined): boolean {
  return profile?.status === "ACTIVE";
}

/**
 * Single source of truth for "where does this role land after signing in".
 *
 * The destination carries the caller's own user id (`/webstore/[uid]` for
 * customers, `/owner/[uid]` for owners). The id is a navigation hint only:
 * every protected page re-verifies the session server-side and bounces a
 * visitor whose URL id does not match their own session to their own URL, so
 * the address bar can never be used to reach another account.
 */
export function dashboardPathForRole(role: Role, userId: string): string {
  return role === "OWNER" ? `/owner/${userId}` : `/webstore/${userId}`;
}
