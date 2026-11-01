/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedirectSignal, createSupabaseMock } from "@/tests/helpers/supabase-mock";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000" })),
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn(), delete: vi.fn() })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

import { signInWithOAuthAction, signOutAction } from "./auth";

const createClientMock = vi.mocked(createClient);
const INITIAL_STATE = { status: "idle" as const };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

async function redirectTarget(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("Expected a redirect, but the action resolved.");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signInWithOAuthAction", () => {
  it("starts the Google flow with PKCE and an account chooser", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const target = await redirectTarget(
      signInWithOAuthAction(INITIAL_STATE, form({ provider: "google" })),
    );

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });
    expect(target).toContain("accounts.google.com");
  });

  it("starts the Facebook flow without Google-specific parameters", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    await redirectTarget(signInWithOAuthAction(INITIAL_STATE, form({ provider: "facebook" })));

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "facebook",
      options: { redirectTo: "http://localhost:3000/auth/callback", queryParams: undefined },
    });
  });

  it("drops an off-site next hint instead of forwarding it", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    await redirectTarget(
      signInWithOAuthAction(
        INITIAL_STATE,
        form({ provider: "google", next: "https://evil.example.com" }),
      ),
    );

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("rejects an unknown provider without calling Supabase", async () => {
    const state = await signInWithOAuthAction(INITIAL_STATE, form({ provider: "github" }));

    expect(state.status).toBe("error");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("explains a provider that is not enabled in the project", async () => {
    const mock = createSupabaseMock();
    mock.auth.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: {
        code: "provider_disabled",
        message: "Unsupported provider: provider is not enabled",
        status: 400,
      },
    } as never);
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signInWithOAuthAction(INITIAL_STATE, form({ provider: "facebook" }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not available right now/i);
  });
});

describe("signOutAction", () => {
  it("ends the session and returns to the sign-in page", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(signOutAction())).toBe("/login?notice=signed_out");
    expect(mock.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("still clears the local session when Supabase cannot be reached", async () => {
    const mock = createSupabaseMock();
    mock.auth.signOut.mockResolvedValueOnce({
      error: { message: "fetch failed", status: 0 },
    } as never);
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(signOutAction())).toBe("/login?notice=signed_out");
    expect(mock.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
  });
});
