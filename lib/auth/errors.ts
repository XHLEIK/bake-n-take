/**
 * Authentication error translation.
 *
 * Supabase error payloads are never rendered directly: they can leak internal
 * details (SQL, endpoints, project internals) and are not written for bakery
 * customers. Instead the raw error is classified into a small enum of stable
 * codes that can safely travel through URLs, and each code maps to a curated
 * message. Unknown errors collapse to a generic message.
 */

export const AUTH_ERROR_CODES = [
  "invalid_credentials",
  "email_not_confirmed",
  "email_in_use",
  "weak_password",
  "rate_limited",
  "oauth_cancelled",
  "oauth_failed",
  "oauth_unavailable",
  "session_expired",
  "link_expired",
  "account_disabled",
  "not_authorized",
  "owner_only",
  "network",
  "invalid_input",
  "unknown",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: "That email and password combination is not correct.",
  email_not_confirmed:
    "This account cannot sign in yet. If you just registered, please try signing up once more — otherwise contact the bakery so we can enable it for you.",
  email_in_use: "An account already exists for this email address. Try signing in instead.",
  weak_password:
    "Please choose a stronger password: at least 8 characters, with a letter and a number.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  oauth_cancelled: "Sign-in was cancelled before it finished. You can try again whenever you like.",
  oauth_failed: "We could not complete that sign-in. Please try again or use your email instead.",
  oauth_unavailable:
    "That sign-in option is not available right now. Please use email and password instead.",
  session_expired: "Your session has ended. Please sign in again to continue.",
  link_expired: "That link is no longer valid. Please request a new one.",
  account_disabled: "This account is not active. Please contact the bakery for help.",
  not_authorized: "You do not have access to that area.",
  owner_only:
    "That account does not have owner access. Please sign in with the owner account, or use the customer sign-in.",
  network: "We could not reach the bakery right now. Check your connection and try again.",
  invalid_input: "Please check the highlighted fields and try again.",
  unknown: "Something went wrong on our side. Please try again in a moment.",
};

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === "string" && (AUTH_ERROR_CODES as readonly string[]).includes(value);
}

/** Curated, user-facing message for a stable error code. */
export function authErrorMessage(code: AuthErrorCode): string {
  return MESSAGES[code] ?? MESSAGES.unknown;
}

/** URL-safe code used by `/login?error=...` and friends. */
export function authErrorCodeFromQuery(value: unknown): AuthErrorCode | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return undefined;
  const normalised = raw.trim().toLowerCase();
  return isAuthErrorCode(normalised) ? normalised : undefined;
}

type AuthErrorLike = { code?: unknown; status?: unknown; message?: unknown };

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = (error as AuthErrorLike | null)?.message;
  return (
    typeof message === "string" &&
    /fetch failed|failed to fetch|networkerror|load failed/i.test(message)
  );
}

/**
 * Classifies any thrown value into a stable code. The mapping is intentionally
 * narrow: a code is only reused when its meaning is certain.
 */
export function authErrorCode(error: unknown): AuthErrorCode {
  if (!error) return "unknown";
  if (isNetworkFailure(error)) return "network";

  const { code, message, status } = (error ?? {}) as AuthErrorLike;
  const text = typeof message === "string" ? message.toLowerCase() : "";

  if (typeof status === "number" && status === 0) return "network";

  switch (code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "email_in_use";
    case "weak_password":
      return "weak_password";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
    case "over_sms_send_rate_limit":
      return "rate_limited";
    case "same_password":
      return "weak_password";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return "link_expired";
    case "user_banned":
      return "account_disabled";
    case "validation_failed":
      return "invalid_input";
    case "provider_disabled":
      return "oauth_unavailable";
    case "session_not_found":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return "session_expired";
    default:
      break;
  }

  if (/provider is not enabled|unsupported provider/.test(text)) return "oauth_unavailable";
  if (/rate limit|too many requests|security purposes|can only request this after/.test(text)) {
    return "rate_limited";
  }
  if (/invalid login credentials/.test(text)) return "invalid_credentials";
  if (/email not confirmed/.test(text)) return "email_not_confirmed";
  if (/already registered|already exists/.test(text)) return "email_in_use";
  if (/password should be at least|password is too short/.test(text)) return "weak_password";
  if (/has expired|is invalid|already used/.test(text)) return "link_expired";
  if (/auth session missing|session from session claim/.test(text)) return "session_expired";

  return "unknown";
}

/** Maps a failed OAuth provider callback into a code. */
export function oauthCallbackErrorCode(error: unknown, errorDescription: unknown): AuthErrorCode {
  const code = authErrorCodeFromQuery(error);
  const description = typeof errorDescription === "string" ? errorDescription.toLowerCase() : "";

  if (code === "oauth_cancelled") return "oauth_cancelled";
  if (/access_denied|cancell?ed|user denied/.test(description)) return "oauth_cancelled";
  if (code === "oauth_unavailable" || code === "rate_limited") return code;
  return "oauth_failed";
}

/**
 * Reads a safe error code from route search params.
 *
 * Only codes in the curated list are accepted, so a crafted `?error=` value can
 * never inject text into the page.
 */
export function searchParamErrorCode(
  params: Record<string, string | string[] | undefined>,
): AuthErrorCode | undefined {
  return authErrorCodeFromQuery(params.error);
}
