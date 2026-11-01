/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { subscribeNewsletterAction } from "./actions";

const getSessionMock = vi.mocked(getSessionContext);
const createClientMock = vi.mocked(createClient);

const IDLE = { status: "idle" as const };

function form(email: string): FormData {
  const data = new FormData();
  data.set("email", email);
  return data;
}

function session() {
  getSessionMock.mockResolvedValue({
    user: { id: "customer-id" },
    profile: {
      id: "customer-id",
      fullName: "Customer",
      email: "customer@example.com",
      phone: null,
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  } as never);
}

describe("subscribeNewsletterAction", () => {
  it("requires a signed-in customer", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await subscribeNewsletterAction(IDLE, form("a@example.com"));
    expect(result.status).toBe("error");
  });

  it("rejects invalid addresses without touching the database", async () => {
    session();
    const insert = vi.fn();
    createClientMock.mockResolvedValue({ from: () => ({ insert }) } as never);
    const result = await subscribeNewsletterAction(IDLE, form("not-an-email"));
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("subscribes with a normalized address", async () => {
    session();
    const insert = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ from: () => ({ insert }) } as never);
    const result = await subscribeNewsletterAction(IDLE, form("  FRIEND@Example.COM "));
    expect(result.status).toBe("success");
    expect(insert).toHaveBeenCalledWith({
      email: "friend@example.com",
      customer_id: "customer-id",
    });
  });

  it("confirms duplicates instead of erroring", async () => {
    session();
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    createClientMock.mockResolvedValue({ from: () => ({ insert }) } as never);
    const result = await subscribeNewsletterAction(IDLE, form("friend@example.com"));
    expect(result.status).toBe("success");
    expect(result.message).toMatch(/already on the list/i);
  });
});
