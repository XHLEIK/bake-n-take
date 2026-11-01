import { describe, expect, it } from "vitest";

import {
  AUTH_ERROR_CODES,
  authErrorCode,
  authErrorCodeFromQuery,
  authErrorMessage,
  oauthCallbackErrorCode,
  searchParamErrorCode,
} from "./errors";

describe("authErrorCode", () => {
  it("maps Supabase error codes to stable codes", () => {
    expect(authErrorCode({ code: "invalid_credentials" })).toBe("invalid_credentials");
    expect(authErrorCode({ code: "email_not_confirmed" })).toBe("email_not_confirmed");
    expect(authErrorCode({ code: "user_already_exists" })).toBe("email_in_use");
    expect(authErrorCode({ code: "email_exists" })).toBe("email_in_use");
    expect(authErrorCode({ code: "weak_password" })).toBe("weak_password");
    expect(authErrorCode({ code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(authErrorCode({ code: "otp_expired" })).toBe("link_expired");
    expect(authErrorCode({ code: "flow_state_not_found" })).toBe("link_expired");
    expect(authErrorCode({ code: "user_banned" })).toBe("account_disabled");
    expect(authErrorCode({ code: "validation_failed" })).toBe("invalid_input");
    expect(authErrorCode({ code: "provider_disabled" })).toBe("oauth_unavailable");
  });

  it("falls back to message heuristics", () => {
    expect(authErrorCode({ message: "Unsupported provider: provider is not enabled" })).toBe(
      "oauth_unavailable",
    );
    expect(authErrorCode({ message: "Invalid login credentials" })).toBe("invalid_credentials");
    expect(authErrorCode({ message: "Email not confirmed" })).toBe("email_not_confirmed");
    expect(
      authErrorCode({ message: "For security purposes, you can only request this after x" }),
    ).toBe("rate_limited");
  });

  it("classifies network failures without leaking them", () => {
    expect(authErrorCode(new TypeError("fetch failed"))).toBe("network");
    expect(authErrorCode({ message: "Failed to fetch" })).toBe("network");
    expect(authErrorCode({ status: 0, message: "boom" })).toBe("network");
  });

  it("collapses anything unknown", () => {
    expect(authErrorCode(null)).toBe("unknown");
    expect(authErrorCode(undefined)).toBe("unknown");
    expect(authErrorCode({ code: "pg_error", message: 'relation "profiles" does not exist' })).toBe(
      "unknown",
    );
    expect(authErrorCode({ message: "duplicate key value violates unique constraint" })).toBe(
      "unknown",
    );
  });

  it("never returns a code outside the curated list", () => {
    const inputs = [
      null,
      undefined,
      0,
      "",
      "boom",
      { code: "whatever" },
      { message: "invalid grant: refresh token already used" },
      new Error("jwt malformed"),
      { code: "session_not_found" },
    ];

    for (const input of inputs) {
      expect(AUTH_ERROR_CODES).toContain(authErrorCode(input));
    }
  });
});

describe("authErrorMessage", () => {
  it("returns human-readable, non-technical copy", () => {
    const messages = AUTH_ERROR_CODES.map((code) => authErrorMessage(code));
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/supabase|jwt|sql|token|stack/i);
      expect(message.endsWith(".")).toBe(true);
    }
    expect(new Set(messages).size).toBe(messages.length);
  });
});

describe("authErrorCodeFromQuery", () => {
  it("accepts only curated codes", () => {
    expect(authErrorCodeFromQuery("invalid_credentials")).toBe("invalid_credentials");
    expect(authErrorCodeFromQuery("INVALID_CREDENTIALS")).toBe("invalid_credentials");
    expect(authErrorCodeFromQuery("<script>alert(1)</script>")).toBeUndefined();
    expect(authErrorCodeFromQuery("relation profiles does not exist")).toBeUndefined();
    expect(authErrorCodeFromQuery(undefined)).toBeUndefined();
    expect(authErrorCodeFromQuery(["network"])).toBe("network");
  });

  it("reads the code from route search params", () => {
    expect(searchParamErrorCode({ error: "session_expired" })).toBe("session_expired");
    expect(searchParamErrorCode({ error: ["oauth_failed"] })).toBe("oauth_failed");
    expect(searchParamErrorCode({})).toBeUndefined();
  });
});

describe("oauthCallbackErrorCode", () => {
  it("recognises user cancellation", () => {
    expect(oauthCallbackErrorCode("access_denied", "User denied access")).toBe("oauth_cancelled");
    expect(oauthCallbackErrorCode("oauth_cancelled", undefined)).toBe("oauth_cancelled");
  });

  it("keeps actionable codes and otherwise reports a generic failure", () => {
    expect(oauthCallbackErrorCode("rate_limited", undefined)).toBe("rate_limited");
    expect(oauthCallbackErrorCode(undefined, undefined)).toBe("oauth_failed");
    expect(oauthCallbackErrorCode("server_error", "internal error text")).toBe("oauth_failed");
  });
});
