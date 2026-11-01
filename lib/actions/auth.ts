"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authErrorCode, authErrorMessage } from "@/lib/auth/errors";
import { errorState, successState, type AuthFormState } from "@/lib/auth/form-state";
import { authNoticeMessage } from "@/lib/auth/notices";
import { AUTH_ROUTES, destinationForRole, pathWithParams, safeNextPath } from "@/lib/auth/paths";
import { dashboardPathForRole, isActive } from "@/lib/auth/roles";
import { fetchProfile } from "@/lib/auth/session";
import { authRedirectUrl } from "@/lib/env";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  parseForm,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

/**
 * Authentication Server Actions.
 *
 * All of them run on the server, validate their own input, and let Supabase
 * Auth own the credentials. None of them accept a role from the client: the
 * role is always read back from `public.profiles`, which RLS protects.
 */

const OAUTH_PROVIDERS = ["google", "facebook"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Origin used for Supabase redirect URLs.
 *
 * `NEXT_PUBLIC_SITE_URL` wins whenever it is configured (production and
 * preview deployments should always set it). Only as a local-development
 * convenience is the request host used, and it is sanitised first so a crafted
 * Host header cannot push reset links to an attacker-controlled domain.
 */
async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const rawHost = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const host = rawHost.replace(/[^a-zA-Z0-9.:\-[\]]/g, "").toLowerCase() || "localhost:3000";
  const forwardedProto = headerList.get("x-forwarded-proto");
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
        ? "http"
        : "https";
  return `${proto}://${host}`;
}

/** Email/password sign-in for customers and owners alike. */
export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(formData, signInSchema, ["email", "password"]);
  if (!parsed.ok) return errorState(authErrorMessage("invalid_input"), parsed.fieldErrors);

  const requestedPath = safeNextPath(formData.get("next"), "");
  // The owner sign-in screen asks for OWNER. This flag can only *narrow* access
  // (it is a required role, never a granted one), so accepting it from the form
  // cannot escalate anything.
  const requiresOwner = formData.get("requireOwner") === "1";
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });

  if (error || !data.user) return errorState(authErrorMessage(authErrorCode(error)));

  const profile = await fetchProfile(supabase, data.user.id);
  if (!profile) return errorState(authErrorMessage("unknown"));
  if (!isActive(profile)) {
    await supabase.auth.signOut({ scope: "local" });
    return errorState(authErrorMessage("account_disabled"));
  }

  // Do not leave a non-owner signed in through the staff entrance.
  if (requiresOwner && profile.role !== "OWNER") {
    await supabase.auth.signOut({ scope: "local" });
    return errorState(authErrorMessage("owner_only"));
  }

  redirect(destinationForRole(profile.role, requestedPath || undefined, data.user.id));
}

/**
 * Customer registration. The role is never part of the request.
 *
 * Email confirmation is disabled for this project (see
 * docs/SUPABASE-SETUP.md), so a successful signup returns a session and the
 * customer lands straight in their area. When no session is issued, something
 * is misconfigured server-side: the signup page shows an error instead of
 * pretending a confirmation email is on its way.
 */
export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(formData, signUpSchema, ["fullName", "email", "phone", "password"]);
  if (!parsed.ok) return errorState(authErrorMessage("invalid_input"), parsed.fieldErrors);

  const origin = await requestOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    options: {
      // Only non-privileged profile fields travel as metadata. The database
      // trigger assigns the CUSTOMER role and ignores anything else.
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone ? parsed.data.phone : null,
      },
      emailRedirectTo: authRedirectUrl(AUTH_ROUTES.callback, origin),
    },
  });

  if (error) return errorState(authErrorMessage(authErrorCode(error)));

  // Confirmation is disabled, so Supabase signs the new account in at once.
  if (data.session && data.user) {
    const profile = await fetchProfile(supabase, data.user.id);
    redirect(profile ? dashboardPathForRole(profile.role, data.user.id) : "/");
  }

  // No session: the project still requires email confirmation (or the address
  // already exists and Supabase is masking it). Self-heal by confirming the
  // just-registered address with the service role and signing straight in, so
  // registration completes even when the dashboard toggle was left on.
  if (data.user) {
    const healed = await confirmAndSignIn(
      data.user.id,
      parsed.data.email.toLowerCase(),
      parsed.data.password,
    );
    if (healed) {
      const profile = await fetchProfile(supabase, healed.id);
      redirect(profile ? dashboardPathForRole(profile.role, healed.id) : "/");
    }
  }

  return errorState(authErrorMessage("email_not_confirmed"));
}

/**
 * Safety net for projects where "Confirm email" is still enabled.
 *
 * Confirms the address Supabase just registered (the id comes from Supabase's
 * own signup response, never from client input) and signs in with the
 * validated credentials. Returns the user on success, null when the service
 * key is missing or any step fails — the caller then shows the regular error.
 * Nothing here can confirm an address that was not just registered through
 * this action.
 */
async function confirmAndSignIn(
  userId: string,
  email: string,
  password: string,
): Promise<{ id: string } | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;

  try {
    const admin = createServiceClient();
    const { error: confirmError } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}

/** Starts the OAuth (PKCE) flow; Supabase returns the provider URL to visit. */
export async function signInWithOAuthAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) return errorState(authErrorMessage("invalid_input"));

  const requestedPath = safeNextPath(formData.get("next"), "");
  const origin = await requestOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectUrl(
        pathWithParams(AUTH_ROUTES.callback, { next: requestedPath || undefined }),
        origin,
      ),
      queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
    },
  });

  if (error || !data?.url) {
    const code = authErrorCode(error);
    return errorState(authErrorMessage(code === "unknown" ? "oauth_failed" : code));
  }

  redirect(data.url);
}

/** Ends the session and revokes the refresh token. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  // If Supabase cannot be reached, still clear the local session so a user is
  // never stuck "signed in" with a token that cannot be revoked.
  if (error) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }

  redirect(pathWithParams(AUTH_ROUTES.login, { notice: "signed_out" }));
}

/**
 * Sends a password reset link.
 *
 * The response never reveals whether the address exists, which keeps this
 * endpoint useless for account enumeration.
 */
export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(formData, forgotPasswordSchema, ["email"]);
  if (!parsed.ok) return errorState(authErrorMessage("invalid_input"), parsed.fieldErrors);

  const origin = await requestOrigin();
  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase(), {
    redirectTo: authRedirectUrl(
      pathWithParams(AUTH_ROUTES.callback, { next: AUTH_ROUTES.updatePassword }),
      origin,
    ),
  });

  return successState(authNoticeMessage("password_reset_sent"));
}

/** Sets a new password for the signed-in recovery session. */
export async function updatePasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(formData, updatePasswordSchema, ["password", "confirmPassword"]);
  if (!parsed.ok) return errorState(authErrorMessage("invalid_input"), parsed.fieldErrors);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return errorState(authErrorMessage("session_expired"));

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return errorState(authErrorMessage(authErrorCode(error)));

  const profile = await fetchProfile(supabase, user.id);
  redirect(
    pathWithParams(profile ? dashboardPathForRole(profile.role, user.id) : "/", {
      notice: "password_updated",
    }),
  );
}
