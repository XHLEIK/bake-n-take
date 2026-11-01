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
  createServiceClient: vi.fn(),
}));

import { createClient, createServiceClient } from "@/lib/supabase/server";

import { requestPasswordResetAction, signUpAction, updatePasswordAction } from "./auth";

const createClientMock = vi.mocked(createClient);
const createServiceClientMock = vi.mocked(createServiceClient);
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

describe("signUpAction", () => {
  const valid = {
    fullName: "Aarav Sharma",
    email: "Aarav@Example.com",
    phone: "",
    password: "sourdough1",
  };

  it("rejects a weak password before touching Supabase", async () => {
    const state = await signUpAction(INITIAL_STATE, form({ ...valid, password: "weak" }));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.password).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("sends only non-privileged profile fields as metadata", async () => {
    const mock = createSupabaseMock({ profile: null });
    mock.auth.signUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t" } },
      error: null,
    });
    createClientMock.mockResolvedValue(mock.client as never);

    await redirectTarget(signUpAction(INITIAL_STATE, form(valid)));

    expect(mock.auth.signUp).toHaveBeenCalledWith({
      email: "aarav@example.com",
      password: "sourdough1",
      options: {
        data: { full_name: "Aarav Sharma", phone: null },
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });
  });

  it("returns an error instead of a confirmation notice when no session is issued", async () => {
    const mock = createSupabaseMock({ profile: null });
    mock.auth.signUp.mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signUpAction(INITIAL_STATE, form(valid));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/cannot sign in yet/i);
  });

  it("uses the same error when the address already exists (no enumeration)", async () => {
    const mock = createSupabaseMock({ profile: null });
    mock.auth.signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [] }, session: null },
      error: null,
    });
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signUpAction(INITIAL_STATE, form(valid));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/cannot sign in yet/i);
  });

  it("goes straight to the account when confirmation is disabled", async () => {
    const mock = createSupabaseMock();
    mock.auth.signUp.mockResolvedValue({
      data: { user: { id: profileRow().id }, session: { access_token: "t" } },
      error: null,
    });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(signUpAction(INITIAL_STATE, form(valid)))).toBe(
      `/webstore/${profileRow().id}`,
    );
  });

  it("self-heals when the dashboard still requires confirmation", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    try {
      const updateUserById = vi.fn(async () => ({ data: {}, error: null }));
      createServiceClientMock.mockReturnValue({ auth: { admin: { updateUserById } } } as never);

      const mock = createSupabaseMock();
      mock.auth.signUp.mockResolvedValue({
        data: { user: { id: profileRow().id }, session: null },
        error: null,
      });
      mock.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: profileRow().id }, session: { access_token: "t" } },
        error: null,
      });
      createClientMock.mockResolvedValue(mock.client as never);

      expect(await redirectTarget(signUpAction(INITIAL_STATE, form(valid)))).toBe(
        `/webstore/${profileRow().id}`,
      );
      expect(updateUserById).toHaveBeenCalledWith(profileRow().id, { email_confirm: true });
      expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "aarav@example.com",
        password: "sourdough1",
      });
    } finally {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("shows the regular error when the safety net cannot confirm", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    try {
      const updateUserById = vi.fn(async () => ({
        data: null,
        error: { message: "forbidden", status: 403 },
      }));
      createServiceClientMock.mockReturnValue({ auth: { admin: { updateUserById } } } as never);

      const mock = createSupabaseMock({ profile: null });
      mock.auth.signUp.mockResolvedValue({
        data: { user: { id: "u1" }, session: null },
        error: null,
      });
      createClientMock.mockResolvedValue(mock.client as never);

      const state = await signUpAction(INITIAL_STATE, form(valid));

      expect(state.status).toBe("error");
      expect(state.message).toMatch(/cannot sign in yet/i);
      expect(mock.auth.signInWithPassword).not.toHaveBeenCalled();
    } finally {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("reports a duplicate email returned as an error", async () => {
    const mock = createSupabaseMock({ profile: null });
    mock.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: "user_already_exists",
        message: "User already registered",
        status: 400,
      },
    } as never);
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await signUpAction(INITIAL_STATE, form(valid));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/already exists/i);
  });
});

describe("updatePasswordAction", () => {
  it("requires both passwords to match", async () => {
    const state = await updatePasswordAction(
      INITIAL_STATE,
      form({ password: "sourdough1", confirmPassword: "sourdough2" }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.confirmPassword).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("refuses to change a password without a recovery session", async () => {
    const mock = createSupabaseMock();
    mock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await updatePasswordAction(
      INITIAL_STATE,
      form({ password: "sourdough1", confirmPassword: "sourdough1" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/session has ended/i);
    expect(mock.auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and returns the user to their area", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ role: "OWNER" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    const target = await redirectTarget(
      updatePasswordAction(
        INITIAL_STATE,
        form({ password: "sourdough1", confirmPassword: "sourdough1" }),
      ),
    );

    expect(mock.auth.updateUser).toHaveBeenCalledWith({ password: "sourdough1" });
    expect(target).toBe(`/owner/${profileRow().id}?notice=password_updated`);
  });

  it("surfaces a rejected password change as a curated message", async () => {
    const mock = createSupabaseMock();
    mock.auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: {
        code: "weak_password",
        message: "Password should be at least 6 characters",
        status: 422,
      },
    } as never);
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await updatePasswordAction(
      INITIAL_STATE,
      form({ password: "sourdough1", confirmPassword: "sourdough1" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/stronger password/i);
  });
});

describe("requestPasswordResetAction", () => {
  it("validates the email before contacting Supabase", async () => {
    const state = await requestPasswordResetAction(INITIAL_STATE, form({ email: "nope" }));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("uses the callback route and the configured origin", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await requestPasswordResetAction(
      INITIAL_STATE,
      form({ email: "Aarav@Example.com" }),
    );

    expect(mock.auth.resetPasswordForEmail).toHaveBeenCalledWith("aarav@example.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=%2Fupdate-password",
    });
    expect(state.status).toBe("success");
  });

  it("gives the same answer whether or not the address exists", async () => {
    const mock = createSupabaseMock();
    mock.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: "user_not_found", message: "User not found", status: 404 },
    } as never);
    createClientMock.mockResolvedValue(mock.client as never);

    const state = await requestPasswordResetAction(INITIAL_STATE, form({ email: "nobody@x.co" }));

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/if an account exists/i);
  });
});
