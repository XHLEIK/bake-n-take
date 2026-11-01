/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedirectSignal, createSupabaseMock, profileRow } from "@/tests/helpers/supabase-mock";

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

import { signInAction, signInWithOAuthAction, signOutAction } from "./auth";

const createClientMock = vi.mocked(createClient);
const INITIAL_STATE = { status: "idle" as const };

export function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

export async function redirectTarget(action: Promise<unknown>): Promise<string> {
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

describe("signInAction", () => {
  it("rejects malformed input before touching Supabase", async () => {
    const state = await signInAction(INITIAL_STATE, form({ email: "", password: "" }));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("reports invalid credentials without revealing which half was wrong", async () => {
    const mock = createSupabaseMock();
    mock.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
    } as never);
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signInAction(
      INITIAL_STATE,
      form({ email: "Aarav@Example.com", password: "sourdough1" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not correct/i);
    expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "aarav@example.com",
      password: "sourdough1",
    });
  });

  it("sends a customer to their webstore page", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const target = await redirectTarget(
      signInAction(INITIAL_STATE, form({ email: "aarav@example.com", password: "sourdough1" })),
    );

    expect(target).toBe(`/webstore/${profileRow().id}`);
  });

  it("sends an owner to their owner page", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ role: "OWNER" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    const target = await redirectTarget(
      signInAction(INITIAL_STATE, form({ email: "owner@example.com", password: "sourdough1" })),
    );

    expect(target).toBe(`/owner/${profileRow().id}`);
  });

  it("never lets a client-supplied next value cross into another area", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const target = await redirectTarget(
      signInAction(
        INITIAL_STATE,
        form({ email: "aarav@example.com", password: "sourdough1", next: "/owner" }),
      ),
    );

    expect(target).toBe(`/webstore/${profileRow().id}`);
  });

  it("honours a next hint inside the caller's own area", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const target = await redirectTarget(
      signInAction(
        INITIAL_STATE,
        form({ email: "aarav@example.com", password: "sourdough1", next: "/customer/orders" }),
      ),
    );

    expect(target).toBe("/customer/orders");
  });

  it("refuses the owner entrance for a customer and clears the session", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signInAction(
      INITIAL_STATE,
      form({ email: "aarav@example.com", password: "sourdough1", requireOwner: "1" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/owner access/i);
    expect(mock.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("refuses a suspended account and clears the session", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ status: "SUSPENDED" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signInAction(
      INITIAL_STATE,
      form({ email: "aarav@example.com", password: "sourdough1" }),
    );

    expect(state.message).toMatch(/not active/i);
    expect(mock.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("fails closed when the profile cannot be read", async () => {
    const mock = createSupabaseMock({ profile: null });
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signInAction(
      INITIAL_STATE,
      form({ email: "aarav@example.com", password: "sourdough1" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toBeTruthy();
  });

  it("propagates an unexpected network failure instead of inventing a session", async () => {
    const mock = createSupabaseMock();
    mock.auth.signInWithPassword.mockRejectedValue(new TypeError("fetch failed"));
    createClientMock.mockResolvedValue(mock.client as never);

    await expect(
      signInAction(INITIAL_STATE, form({ email: "a@b.co", password: "sourdough1" })),
    ).rejects.toThrowError(TypeError);
  });
});
