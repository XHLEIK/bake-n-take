/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, profileRow } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

const createClientMock = vi.mocked(createClient);

const CUSTOMER_AREA = `/webstore/${profileRow().id}`;
const OWNER_AREA = `/owner/${profileRow().id}`;

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/auth/callback${query}`);
}

function locationOf(response: Response): string {
  return (
    new URL(response.headers.get("location") ?? "").pathname +
    new URL(response.headers.get("location") ?? "").search
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("reports a cancelled provider sign-in instead of an internal error", async () => {
    const response = await GET(request("?error=access_denied&error_description=User+denied"));

    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe("/login?error=oauth_cancelled");
  });

  it("rejects a callback with no credentials at all", async () => {
    const response = await GET(request(""));
    expect(locationOf(response)).toBe("/login?error=link_expired");
  });

  it("rejects a malformed token_hash/type combination", async () => {
    const response = await GET(request("?token_hash=abc&type=not-a-type"));
    expect(locationOf(response)).toBe("/login?error=link_expired");
  });

  it("exchanges a PKCE code and sends a customer to their webstore page", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?code=valid-code"));
    const location = response.headers.get("location") ?? "";

    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(new URL(location).pathname).toBe(CUSTOMER_AREA);
  });

  it("sends an owner to their owner page", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ role: "OWNER" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?code=valid-code"));
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(OWNER_AREA);
  });

  it("honours a safe next hint inside the caller's area and ignores a cross-area hint", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const safe = await GET(request("?code=c&next=%2Fcustomer%2Forders"));
    expect(new URL(safe.headers.get("location") ?? "").pathname).toBe("/customer/orders");

    const crossArea = await GET(request("?code=c&next=%2Fowner"));
    expect(new URL(crossArea.headers.get("location") ?? "").pathname).toBe(CUSTOMER_AREA);
  });

  it("ignores an off-site next hint", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?code=c&next=https%3A%2F%2Fevil.example.com"));
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(CUSTOMER_AREA);
  });

  it("routes email OTP confirmations to the customer area", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?token_hash=hash&type=signup"));

    expect(mock.auth.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "hash" });
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(CUSTOMER_AREA);
  });

  it("routes password recovery to the update-password screen", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?token_hash=hash&type=recovery&next=%2Fupdate-password"));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/update-password");
  });

  it("reports an expired or reused link", async () => {
    const mock = createSupabaseMock();
    mock.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "flow_state_not_found", message: "invalid flow state" },
    } as never);
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?code=stale"));
    expect(locationOf(response)).toBe("/login?error=link_expired");
  });

  it("refuses an inactive account and clears its local session", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ status: "SUSPENDED" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?code=valid-code"));

    expect(locationOf(response)).toBe("/login?error=account_disabled");
    expect(mock.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("never redirects with a raw Supabase message", async () => {
    const mock = createSupabaseMock({ profile: null });
    createClientMock.mockResolvedValue(mock.client as never);

    const response = await GET(request("?code=valid-code"));
    expect(locationOf(response)).toBe("/login?error=unknown");
  });
});
