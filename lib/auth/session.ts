import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { AuthErrorCode } from "./errors";
import { loginPathFor, pathWithParams } from "./paths";
import {
  dashboardPathForRole,
  isAccountStatus,
  isActive,
  isOwner,
  isRole,
  type Profile,
} from "./roles";

/**
 * Server-side Data Access Layer (DAL).
 *
 * This is the authorization boundary of the application: every protected page,
 * Server Action and Route Handler resolves the caller through these helpers.
 * Supabase Auth remains the authentication authority — the session is verified
 * with `auth.getUser()` on the server, which validates the JWT with Supabase
 * rather than trusting anything the browser sent.
 *
 * React's `cache()` memoises the lookups for the duration of a single render
 * pass, so a page and its components share one verification round trip.
 */

export type SessionContext = {
  user: User;
  profile: Profile;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
};

const PROFILE_COLUMNS = "id, full_name, email, phone, role, status";

/**
 * Maps a database row to the application profile. Unknown enum values fail
 * closed: the row is rejected rather than guessed, so a future role value can
 * never be mistaken for CUSTOMER (or worse, OWNER).
 */
export function mapProfileRow(row: ProfileRow): Profile | null {
  if (!row?.id || !isRole(row.role) || !isAccountStatus(row.status)) return null;
  return {
    id: row.id,
    fullName: row.full_name?.trim() || row.email?.split("@")[0] || "Friend",
    email: row.email ?? "",
    phone: row.phone,
    role: row.role,
    status: row.status,
  };
}

/** Verified Supabase user for the current request, or null. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
});

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Reads an application profile with a client that is already authenticated.
 *
 * Used inside Server Actions and Route Handlers, where the freshly exchanged
 * session lives on the client instance rather than on a new request.
 */
export async function fetchProfile(
  client: SupabaseServerClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfileRow(data as ProfileRow);
}

/**
 * Application profile for the current request.
 *
 * RLS restricts visibility to the caller's own row (plus all rows for owners),
 * so this query cannot be used to read another customer's profile.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  return fetchProfile(supabase, user.id);
});

/** Verified user plus profile. Null when either half is missing. */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const [user, profile] = await Promise.all([getSessionUser(), getCurrentProfile()]);
  if (!user || !profile) return null;
  return { user, profile };
});

function loginRedirect(pathname: string, error?: AuthErrorCode): string {
  return pathWithParams(loginPathFor(pathname), { next: pathname, error });
}

/**
 * Requires a signed-in, ACTIVE user. Redirects to the correct login page
 * (customer or owner) otherwise. Suspended accounts are bounced here as well as
 * in RLS, and never get a session-based error page that leaks account details.
 */
export async function requireUser(nextPath: string): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) redirect(loginRedirect(nextPath));
  if (!isActive(session.profile)) redirect(loginRedirect(nextPath, "account_disabled"));
  return session;
}

/**
 * Requires an OWNER. The role is read from the database profile — never from
 * the URL, a cookie, or a client-side value. Customers are sent to their own
 * area with an explanation instead of a blank 404.
 */
export async function requireOwner(nextPath: string): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) redirect(loginRedirect(nextPath));
  if (!isActive(session.profile)) redirect(loginRedirect(nextPath, "account_disabled"));
  if (!isOwner(session.profile)) {
    redirect(
      pathWithParams(dashboardPathForRole("CUSTOMER", session.user.id), {
        error: "not_authorized",
      }),
    );
  }
  return session;
}

/** Requires any signed-in, ACTIVE user without a role constraint. */
export async function requireSession(nextPath: string): Promise<SessionContext> {
  return requireUser(nextPath);
}

/**
 * For login/signup pages: sends already-authenticated visitors to their area.
 *
 * `error` short-circuits the redirect. Without it, a signed-in user whose
 * profile is missing would ping-pong between the page and its own redirect.
 */
export async function redirectIfAuthenticated(error?: AuthErrorCode): Promise<void> {
  if (error) return;
  const session = await getSessionContext();
  if (session && isActive(session.profile)) {
    redirect(dashboardPathForRole(session.profile.role, session.user.id));
  }
}

/** Owner login page: only owners are bounced away. */
export async function redirectIfOwner(error?: AuthErrorCode): Promise<void> {
  if (error) return;
  const session = await getSessionContext();
  if (session && isActive(session.profile) && isOwner(session.profile)) {
    redirect(dashboardPathForRole("OWNER", session.user.id));
  }
}

/**
 * Verifies that the `[uid]` segment of a per-account URL names the caller.
 *
 * The session is the identity; the URL is only a hint. A mismatch always
 * redirects to the caller's own area URL — the same destination regardless of
 * which id was tried, so the check cannot be used to probe other accounts.
 */
export function redirectIfUidMismatch(session: SessionContext, uid: string): void {
  if (session.user.id !== uid) {
    redirect(dashboardPathForRole(session.profile.role, session.user.id));
  }
}
