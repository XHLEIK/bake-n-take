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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

import {
  mapProfileRow,
  redirectIfUidMismatch,
  requireOwner,
  requireSession,
  requireUser,
} from "./session";

const createClientMock = vi.mocked(createClient);

async function redirectTarget(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("Expected a redirect, but the action resolved.");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapProfileRow", () => {
  it("maps a valid row", () => {
    expect(mapProfileRow(profileRow({ phone: "+91 98765 43210" }))).toEqual({
      id: profileRow().id,
      fullName: "Aarav Sharma",
      email: "aarav@example.com",
      phone: "+91 98765 43210",
      role: "CUSTOMER",
      status: "ACTIVE",
    });
  });

  it("fails closed on unknown roles and statuses", () => {
    expect(mapProfileRow(profileRow({ role: "ADMIN" }))).toBeNull();
    expect(mapProfileRow(profileRow({ role: "owner" }))).toBeNull();
    expect(mapProfileRow(profileRow({ status: "DELETED" }))).toBeNull();
    expect(mapProfileRow({ ...profileRow(), id: "" })).toBeNull();
  });

  it("derives a friendly display name when the row has none", () => {
    expect(mapProfileRow(profileRow({ full_name: null }))?.fullName).toBe("aarav");
    expect(mapProfileRow(profileRow({ full_name: "   " }))?.fullName).toBe("aarav");
    expect(mapProfileRow(profileRow({ full_name: null, email: null }))?.fullName).toBe("Friend");
  });
});

describe("requireUser", () => {
  it("redirects unauthenticated visitors to the customer sign-in with a next hint", async () => {
    const mock = createSupabaseMock({ user: null, profile: null });
    mock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireUser("/customer"))).toBe("/login?next=%2Fcustomer");
  });

  it("redirects unauthenticated visitors to the owner sign-in for owner routes", async () => {
    const mock = createSupabaseMock({ user: null, profile: null });
    mock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireUser("/owner"))).toBe("/owner/login?next=%2Fowner");
  });

  it("returns the session for an active customer", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const session = await requireUser("/customer");

    expect(session.profile.role).toBe("CUSTOMER");
    expect(session.user.id).toBe(profileRow().id);
  });

  it("refuses suspended accounts even with a valid session", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ status: "SUSPENDED" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireUser("/customer"))).toBe(
      "/login?next=%2Fcustomer&error=account_disabled",
    );
  });

  it("refuses a session whose profile is missing", async () => {
    const mock = createSupabaseMock({ profile: null });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireUser("/customer"))).toBe("/login?next=%2Fcustomer");
  });

  it("does not turn a database error into access", async () => {
    const mock = createSupabaseMock();
    mock.state.profileError = { code: "42501", message: "permission denied for table profiles" };
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireUser("/customer"))).toBe("/login?next=%2Fcustomer");
  });
});

describe("requireOwner", () => {
  it("allows an active owner", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ role: "OWNER" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    const session = await requireOwner("/owner");
    expect(session.profile.role).toBe("OWNER");
  });

  it("sends a signed-in customer to their own area instead of the owner area", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireOwner("/owner"))).toBe(
      `/webstore/${profileRow().id}?error=not_authorized`,
    );
  });

  it("sends an unauthenticated visitor to the owner sign-in", async () => {
    const mock = createSupabaseMock({ user: null, profile: null });
    mock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireOwner("/owner"))).toBe("/owner/login?next=%2Fowner");
  });

  it("treats an unknown role as no profile at all (fails closed, no access)", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ role: "MANAGER" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    // An unrecognised role is discarded by the mapper, so the request is treated
    // as unauthenticated rather than being upgraded to a customer or owner.
    expect(await redirectTarget(() => requireOwner("/owner"))).toBe("/owner/login?next=%2Fowner");
  });

  it("refuses a suspended owner", async () => {
    const mock = createSupabaseMock({
      profile: profileRow({ role: "OWNER", status: "SUSPENDED" }),
    });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireOwner("/owner"))).toBe(
      "/owner/login?next=%2Fowner&error=account_disabled",
    );
  });
});

describe("redirectIfUidMismatch", () => {
  it("lets a caller through to the URL that names their own id", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const session = await requireUser(`/webstore/${profileRow().id}`);
    expect(() => redirectIfUidMismatch(session, profileRow().id)).not.toThrow();
  });

  it("bounces a customer who tries another account's webstore URL to their own", async () => {
    const mock = createSupabaseMock();
    createClientMock.mockResolvedValue(mock.client as never);

    const session = await requireUser("/webstore/someone-else");

    expect(await redirectTarget(async () => redirectIfUidMismatch(session, "someone-else"))).toBe(
      `/webstore/${profileRow().id}`,
    );
  });

  it("bounces an owner who tries another account's owner URL to their own", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ role: "OWNER" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    const session = await requireOwner("/owner/someone-else");

    expect(await redirectTarget(async () => redirectIfUidMismatch(session, "someone-else"))).toBe(
      `/owner/${profileRow().id}`,
    );
  });
});

describe("requireSession", () => {
  it("accepts any active role (used by the password reset screen)", async () => {
    const mock = createSupabaseMock({ profile: profileRow({ role: "OWNER" }) });
    createClientMock.mockResolvedValue(mock.client as never);

    await expect(requireSession("/update-password")).resolves.toBeTruthy();
  });

  it("rejects a visitor without a session", async () => {
    const mock = createSupabaseMock({ user: null, profile: null });
    mock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    createClientMock.mockResolvedValue(mock.client as never);

    expect(await redirectTarget(() => requireSession("/update-password"))).toBe(
      "/login?next=%2Fupdate-password",
    );
  });
});
