import { NextResponse, type NextRequest } from "next/server";

import { authErrorCode, oauthCallbackErrorCode, type AuthErrorCode } from "@/lib/auth/errors";
import { AUTH_ROUTES, destinationForRole, pathWithParams, safeNextPath } from "@/lib/auth/paths";
import { isActive } from "@/lib/auth/roles";
import { fetchProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth callback.
 *
 * Handles every way Supabase can return a user to the app:
 *  - `?code=` — PKCE authorization code (OAuth providers, email links),
 *  - `?token_hash=&type=` — email OTP links (confirmation, recovery, invite),
 *  - `?error=&error_description=` — provider refusal or user cancellation.
 *
 * Sessions are established by exchanging those credentials with Supabase here,
 * on the server, so no token ever passes through browser JavaScript or a URL
 * the client keeps. Failures redirect with a curated error code — never with a
 * raw Supabase message.
 */

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];

function isOtpType(value: unknown): value is OtpType {
  return typeof value === "string" && (OTP_TYPES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const requestedNext = safeNextPath(searchParams.get("next"), "");

  const fail = (error: AuthErrorCode) =>
    NextResponse.redirect(new URL(pathWithParams(AUTH_ROUTES.login, { error }), request.url));

  if (searchParams.get("error")) {
    return fail(
      oauthCallbackErrorCode(searchParams.get("error"), searchParams.get("error_description")),
    );
  }

  const otpType = isOtpType(rawType) ? rawType : null;
  const hasCode = typeof code === "string" && code.length > 0;
  const hasOtp = typeof tokenHash === "string" && tokenHash.length > 0 && otpType !== null;

  if (!hasCode && !hasOtp) return fail("link_expired");

  const supabase = await createClient();
  const { data, error } = hasCode
    ? await supabase.auth.exchangeCodeForSession(code!)
    : await supabase.auth.verifyOtp({ type: otpType!, token_hash: tokenHash! });

  if (error || !data?.user) return fail(authErrorCode(error));

  const profile = await fetchProfile(supabase, data.user.id);
  if (!profile) return fail("unknown");

  if (!isActive(profile)) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return fail("account_disabled");
  }

  // Password recovery sessions go straight to the "choose a new password" form.
  const isRecovery = otpType === "recovery" || requestedNext === AUTH_ROUTES.updatePassword;
  const target = isRecovery
    ? AUTH_ROUTES.updatePassword
    : destinationForRole(profile.role, requestedNext, data.user.id);

  return NextResponse.redirect(new URL(target, request.url));
}
