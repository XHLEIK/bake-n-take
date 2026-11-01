/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedirectSignal } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/auth/session", () => ({
  requireOwner: vi.fn(),
  requireUser: vi.fn(),
  getSessionContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  notFound: vi.fn(),
}));

import { requireOwner, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  applyCouponAction,
  deletePromotionAction,
  removeCouponAction,
  setPromotionStatusAction,
} from "./actions";

const requireOwnerMock = vi.mocked(requireOwner);
const requireUserMock = vi.mocked(requireUser);
const createClientMock = vi.mocked(createClient);

const OWNER = { user: { id: "owner-uid" } };
const CUSTOMER = { user: { id: "customer-uid" } };

/** Chainable query double: awaiting it resolves to its own result fields. */
function q(result: Record<string, unknown> = {}) {
  const chainable: Record<string, unknown> = { data: null, error: null, count: 0, ...result };
  for (const method of [
    "select",
    "eq",
    "in",
    "is",
    "order",
    "limit",
    "update",
    "insert",
    "delete",
    "maybeSingle",
    "single",
  ]) {
    chainable[method] = vi.fn(() => chainable);
  }
  return chainable;
}

function clientFor(
  tables: Record<string, ReturnType<typeof q>> = {},
  storageUpload: unknown = { error: null },
) {
  return {
    from: vi.fn((table: string) => tables[table] ?? q()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => storageUpload),
        remove: vi.fn(async () => ({})),
      })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerMock.mockResolvedValue(OWNER as never);
  requireUserMock.mockResolvedValue(CUSTOMER as never);
});

describe("setPromotionStatusAction", () => {
  it("bounces signed-out visitors before touching the database", async () => {
    requireOwnerMock.mockRejectedValueOnce(new RedirectSignal("/owner/login"));
    const client = clientFor();
    createClientMock.mockResolvedValue(client as never);

    await expect(setPromotionStatusAction("p1", "paused")).rejects.toBeInstanceOf(RedirectSignal);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects malformed ids without a database round trip", async () => {
    const client = clientFor();
    createClientMock.mockResolvedValue(client as never);

    const state = await setPromotionStatusAction("nope", "paused");

    expect(state.status).toBe("error");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects illegal transitions", async () => {
    const client = clientFor({
      promotions: q({ data: { id: "p1", status: "archived" } }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await setPromotionStatusAction("11111111-1111-4111-8111-111111111111", "active");

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not allowed/);
  });

  it("pauses an active offer", async () => {
    const update = vi.fn(() => q({}));
    const chain = q({ data: { id: "p1", status: "active" } });
    chain.update = update.mockImplementation(() => chain);
    const client = clientFor({ promotions: chain });
    createClientMock.mockResolvedValue(client as never);

    const state = await setPromotionStatusAction("11111111-1111-4111-8111-111111111111", "paused");

    expect(state.status).toBe("success");
    expect(update).toHaveBeenCalledWith({ status: "paused" });
  });
});

describe("deletePromotionAction", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("refuses offers with redemptions", async () => {
    const client = clientFor({
      promotions: q({ data: { id: ID, name: "N", status: "archived" } }),
      promotion_redemptions: q({ count: 4 }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await deletePromotionAction(ID);

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/archive/);
  });

  it("refuses non-draft, non-archived offers", async () => {
    const client = clientFor({
      promotions: q({ data: { id: ID, name: "N", status: "active" } }),
      promotion_redemptions: q({ count: 0 }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await deletePromotionAction(ID);

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/draft or archived/);
  });

  it("deletes a clean draft and leaves the list", async () => {
    const client = clientFor({
      promotions: q({ data: { id: ID, name: "N", status: "draft", banner_image_path: null } }),
      promotion_redemptions: q({ count: 0 }),
    });
    createClientMock.mockResolvedValue(client as never);

    await expect(deletePromotionAction(ID)).rejects.toBeInstanceOf(RedirectSignal);
  });
});

describe("customer coupon actions", () => {
  it("rejects malformed codes before touching the database", async () => {
    const client = clientFor();
    createClientMock.mockResolvedValue(client as never);

    const state = await applyCouponAction("bad code!");

    expect(state.status).toBe("error");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("saves a normalized code on the caller's cart", async () => {
    const update = vi.fn(() => q({}));
    const chain = q({ data: { id: "cart-1" } });
    chain.update = update.mockImplementation(() => chain);
    const client = clientFor({ carts: chain });
    createClientMock.mockResolvedValue(client as never);

    const state = await applyCouponAction("summer50");

    expect(state.status).toBe("success");
    expect(update).toHaveBeenCalledWith({ coupon_code: "SUMMER50" });
  });

  it("clears the saved code", async () => {
    const client = clientFor({ carts: q({}) });
    createClientMock.mockResolvedValue(client as never);

    const state = await removeCouponAction();

    expect(state.status).toBe("success");
  });
});
