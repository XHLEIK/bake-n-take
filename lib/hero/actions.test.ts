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

import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { deleteHeroItemAction, moveHeroItemAction, setHeroStatusAction } from "./actions";

const requireOwnerMock = vi.mocked(requireOwner);
const createClientMock = vi.mocked(createClient);

const OWNER = { user: { id: "owner-uid" } };

/** Chainable query double: awaiting it resolves to its own result fields. */
function q(result: Record<string, unknown> = {}) {
  const chainable: Record<string, unknown> = { data: null, error: null, count: 0, ...result };
  for (const method of [
    "select",
    "eq",
    "neq",
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

function clientFor(tables: Record<string, ReturnType<typeof q>> = {}) {
  return {
    from: vi.fn((table: string) => tables[table] ?? q()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({})),
        list: vi.fn(async () => ({ data: [] })),
      })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerMock.mockResolvedValue(OWNER as never);
});

describe("setHeroStatusAction", () => {
  it("bounces signed-out visitors before touching the database", async () => {
    requireOwnerMock.mockRejectedValueOnce(new RedirectSignal("/owner/login"));
    const client = clientFor();
    createClientMock.mockResolvedValue(client as never);

    await expect(setHeroStatusAction("h1", "paused")).rejects.toBeInstanceOf(RedirectSignal);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects malformed ids and illegal transitions", async () => {
    const client = clientFor();
    createClientMock.mockResolvedValue(client as never);
    expect((await setHeroStatusAction("nope", "paused")).status).toBe("error");

    const archived = clientFor({ hero_items: q({ data: { id: "h1", status: "archived" } }) });
    createClientMock.mockResolvedValue(archived as never);
    const state = await setHeroStatusAction("11111111-1111-4111-8111-111111111111", "active");
    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not allowed/);
  });
});

describe("moveHeroItemAction", () => {
  const H1 = "11111111-1111-4111-8111-111111111111";
  const H2 = "22222222-2222-4222-8222-222222222222";

  it("swaps display order with the neighbor", async () => {
    const update = vi.fn(() => q({}));
    const chain = q({
      data: [
        { id: H1, display_order: 1 },
        { id: H2, display_order: 2 },
      ],
    });
    chain.update = update.mockImplementation(() => chain);
    const client = clientFor({ hero_items: chain });
    createClientMock.mockResolvedValue(client as never);

    const state = await moveHeroItemAction(H1, "down");

    expect(state.status).toBe("success");
    expect(update).toHaveBeenCalledWith({ display_order: 2 });
  });

  it("refuses to move past the edge", async () => {
    const client = clientFor({
      hero_items: q({ data: [{ id: H1, display_order: 1 }] }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await moveHeroItemAction(H1, "up");

    expect(state.status).toBe("error");
  });
});

describe("deleteHeroItemAction", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("never deletes system slides", async () => {
    const client = clientFor({
      hero_items: q({ data: { id: ID, status: "active", is_system: true } }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteHeroItemAction(ID);

    expect(state.status).toBe("error");
  });

  it("refuses live slides", async () => {
    const client = clientFor({
      hero_items: q({ data: { id: ID, status: "active", is_system: false } }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteHeroItemAction(ID);

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/draft or archived/);
  });

  it("deletes clean drafts and leaves the list", async () => {
    const client = clientFor({
      hero_items: q({ data: { id: ID, status: "draft", is_system: false, image_path: null } }),
    });
    createClientMock.mockResolvedValue(client as never);

    await expect(deleteHeroItemAction(ID)).rejects.toBeInstanceOf(RedirectSignal);
  });
});
