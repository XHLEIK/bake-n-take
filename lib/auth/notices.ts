/**
 * Curated informational messages that may travel through URLs.
 *
 * Only the codes below are ever rendered, so `?notice=` cannot inject content
 * and never carries personal data such as an email address.
 */

export const AUTH_NOTICES = {
  password_updated: "Your password has been updated.",
  password_reset_sent: "If an account exists for that address, a reset link is on its way.",
  signed_out: "You have been signed out.",
  customer_area: "Welcome back.",
} as const;

export type AuthNoticeCode = keyof typeof AUTH_NOTICES;

export function isAuthNoticeCode(value: unknown): value is AuthNoticeCode {
  return typeof value === "string" && Object.hasOwn(AUTH_NOTICES, value);
}

export function authNoticeMessage(code: AuthNoticeCode): string {
  return AUTH_NOTICES[code];
}

/** Reads a notice code from route search params, ignoring anything unknown. */
export function searchParamNoticeCode(
  params: Record<string, string | string[] | undefined>,
): AuthNoticeCode | undefined {
  const raw = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const normalised = typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
  return isAuthNoticeCode(normalised) ? normalised : undefined;
}
