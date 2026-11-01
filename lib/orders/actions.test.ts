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
  createServiceClient: vi.fn(() => ({
    storage: { from: vi.fn(() => ({ remove: vi.fn(async () => ({})) })) },
  })),
}));

vi.mock("@/lib/orders/repository", () => ({
  getOrderBundle: vi.fn(),
}));

// Store settings hit the network through the key-only client; unit tests
// stay hermetic by standing in for the singleton (null skips the
// store-hours branch — `isWithinStoreHours` itself is covered in
// pickup.test.ts).
vi.mock("@/lib/store/repository", () => ({
  getStoreSettings: vi.fn(async () => null),
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
  RedirectType: { push: "push", replace: "replace" },
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { requireUser, getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOrderBundle } from "@/lib/orders/repository";
import {
  addToCartAction,
  clearCartAction,
  deleteNotificationAction,
  deleteOrderAction,
  deleteReadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  placeOrderAction,
  removeCartItemAction,
  transitionOrderAction,
  updateCartItemQuantityAction,
} from "./actions";
import type { CartItemInput } from "./validation";

const requireUserMock = vi.mocked(requireUser);
const getSessionContextMock = vi.mocked(getSessionContext);
const createClientMock = vi.mocked(createClient);
const getOrderBundleMock = vi.mocked(getOrderBundle);

const CUSTOMER = { user: { id: "customer-uid" } };
const INITIAL_STATE = { status: "idle" as const };
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

/** Chainable query double: awaiting it resolves to its own result fields. */
function q(result: Record<string, unknown> = {}) {
  const chainable: Record<string, unknown> = { data: null, error: null, count: 0, ...result };
  for (const method of [
    "select",
    "eq",
    "is",
    "not",
    "or",
    "order",
    "limit",
    "in",
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

function clientFor(tables: Record<string, ReturnType<typeof q>>, rpc?: unknown) {
  return {
    from: vi.fn((table: string) => tables[table] ?? q()),
    rpc: vi.fn(async () => rpc ?? { data: null, error: null }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({})),
      })),
    },
  };
}

const PRODUCT_ROW = {
  id: PRODUCT_ID,
  name: "Chocolate Cake",
  base_price_paise: 60000,
  is_active: true,
  archived_at: null,
  egg_eggless_enabled: false,
  message_enabled: false,
};

const CONFIG: CartItemInput & { quantity: number } = {
  productId: PRODUCT_ID,
  variantId: "",
  flavourId: "",
  eggEggless: "",
  message: "",
  designPath: "",
  pickupAt: "2030-06-01T10:00:00.000Z",
  quantity: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue(CUSTOMER as never);
  getSessionContextMock.mockResolvedValue({
    user: CUSTOMER.user,
    profile: { role: "CUSTOMER", status: "ACTIVE" },
  } as never);
});
describe("cart authorization", () => {
  it("bounces signed-out visitors before touching the database", async () => {
    requireUserMock.mockRejectedValueOnce(new RedirectSignal("/login"));
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    await expect(addToCartAction({ ...CONFIG })).rejects.toBeInstanceOf(RedirectSignal);
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("addToCartAction", () => {
  it("rejects malformed input without a database round trip", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await addToCartAction({ ...CONFIG, productId: "nope", quantity: 1 });

    expect(state.status).toBe("error");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("refuses configurations the catalog dropped", async () => {
    const client = clientFor({
      products: q({ data: { ...PRODUCT_ROW, archived_at: "2026-01-01T00:00:00Z" } }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await addToCartAction({ ...CONFIG });

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not available/);
  });

  it("prices from the database and inserts a snapshot line", async () => {
    const insert = vi.fn(() => q({ data: { id: "line-9" } }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "products") return q({ data: PRODUCT_ROW });
        if (table === "product_variants") return q({ count: 0 });
        if (table === "product_images") return q({ data: null });
        if (table === "carts") return q({ data: { id: "cart-1" } });
        if (table === "cart_items") {
          const chain = q({ data: null });
          chain.insert = insert;
          return chain;
        }
        return q();
      }),
      storage: { from: vi.fn(() => ({})) },
    };
    createClientMock.mockResolvedValue(client as never);

    const state = await addToCartAction({ ...CONFIG });

    expect(state.status).toBe("success");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: PRODUCT_ID,
        quantity: 2,
        unit_price_paise: 60000,
        product_name: "Chocolate Cake",
      }),
    );
  });

  it("rejects a pickup time that no longer meets the live minimum", async () => {
    const insert = vi.fn();
    const client = {
      from: vi.fn((table: string) => {
        if (table === "products") return q({ data: { ...PRODUCT_ROW, min_prep_minutes: 720 } });
        if (table === "product_variants") return q({ count: 0 });
        if (table === "product_images") return q({ data: null });
        if (table === "cart_items") {
          const chain = q({ data: null });
          chain.insert = insert;
          return chain;
        }
        return q();
      }),
      storage: { from: vi.fn(() => ({})) },
    };
    createClientMock.mockResolvedValue(client as never);

    const state = await addToCartAction({ ...CONFIG, pickupAt: "2020-01-01T10:00:00.000Z" });

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/too soon/);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("updateCartItemQuantityAction", () => {
  it("rejects out-of-range quantities before any query", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    expect((await updateCartItemQuantityAction("i1", 0)).status).toBe("error");
    expect((await updateCartItemQuantityAction("i1", 100)).status).toBe("error");
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("removeCartItemAction", () => {
  it("refuses items from another customer's cart", async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === "cart_items") {
          const chain = q({ data: { id: "i1", cart_id: "cart-other" } });
          chain.delete = vi.fn(async () => ({ error: null }));
          return chain;
        }
        if (table === "carts") return q({ data: null });
        return q();
      }),
      storage: { from: vi.fn(() => ({})) },
    };
    createClientMock.mockResolvedValue(client as never);

    const state = await removeCartItemAction("i1");

    expect(state.status).toBe("error");
  });
});

describe("clearCartAction", () => {
  it("succeeds quietly without a cart", async () => {
    const client = clientFor({ carts: q({ data: null }) });
    createClientMock.mockResolvedValue(client as never);

    const state = await clearCartAction();

    expect(state).toEqual({ status: "success", cartUnitCount: 0 });
  });
});

describe("placeOrderAction", () => {
  function checkoutForm(overrides: Record<string, string> = {}): FormData {
    const data = new FormData();
    data.set("fullName", "Aarav Sharma");
    data.set("phone", "+91 98765 43210");
    data.set("email", "aarav@example.com");
    data.set("paymentMethod", "cod");
    data.set("idempotencyKey", "11111111-1111-4111-8111-111111111111");
    for (const [key, value] of Object.entries(overrides)) data.set(key, value);
    return data;
  }

  it("rejects bad contact details before touching the cart", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await placeOrderAction(INITIAL_STATE, checkoutForm({ phone: "12" }));

    expect(state.status).toBe("error");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("refuses an empty cart", async () => {
    const client = clientFor({ carts: q({ data: null }) });
    createClientMock.mockResolvedValue(client as never);

    const state = await placeOrderAction(INITIAL_STATE, checkoutForm());

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/empty/);
  });

  it("maps a stale-configuration abort to a review message", async () => {
    const client = clientFor({
      carts: q({ data: { id: "cart-1" } }),
      cart_items: q({
        data: [
          {
            id: "line-1",
            product_id: PRODUCT_ID,
            variant_id: null,
            flavour_id: null,
            egg_eggless: null,
            message: null,
            design_path: null,
            pickup_at: "2030-06-01T10:00:00.000Z",
            quantity: 1,
          },
        ],
      }),
    });
    (client as { rpc: ReturnType<typeof vi.fn> }).rpc = vi.fn(async () => ({
      data: null,
      error: { message: "PRODUCT_UNAVAILABLE", code: "P0001" },
    }));
    createClientMock.mockResolvedValue(client as never);

    const state = await placeOrderAction(INITIAL_STATE, checkoutForm());

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/no longer available/);
  });

  it("sends ids only and redirects to the new order", async () => {
    const rpc = vi.fn(async () => ({
      data: { order_id: "order-1", order_number: "BNK-20260929-0001", duplicate: false },
      error: null,
    }));
    const client = clientFor({
      carts: q({ data: { id: "cart-1" } }),
      cart_items: q({
        data: [
          {
            id: "line-1",
            product_id: PRODUCT_ID,
            variant_id: null,
            flavour_id: null,
            egg_eggless: null,
            message: null,
            design_path: null,
            pickup_at: "2030-06-01T10:00:00.000Z",
            quantity: 1,
          },
        ],
      }),
    });
    (client as { rpc?: unknown }).rpc = rpc;
    createClientMock.mockResolvedValue(client as never);

    const failure = await placeOrderAction(INITIAL_STATE, checkoutForm()).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(RedirectSignal);
    expect((failure as RedirectSignal).url).toBe("/webstore/customer-uid/orders/order-1?fresh=1");

    expect(rpc).toHaveBeenCalledWith(
      "create_order",
      expect.objectContaining({
        p_payment_method: "cod",
        p_idempotency_key: "11111111-1111-4111-8111-111111111111",
      }),
    );
    const payload = (rpc.mock.calls[0] as unknown[])[1] as { p_items: Record<string, unknown>[] };
    expect(Object.keys(payload.p_items[0]).sort()).toEqual(
      [
        "design_path",
        "egg_eggless",
        "flavour_id",
        "message",
        "pickup_at",
        "product_id",
        "quantity",
        "variant_id",
      ].sort(),
    );
    expect(payload.p_items[0].pickup_at).toBe("2030-06-01T10:00:00.000Z");
  });

  it("rejects lines without a pickup time before touching the rpc", async () => {
    const rpc = vi.fn();
    const client = clientFor({
      carts: q({ data: { id: "cart-1" } }),
      cart_items: q({
        data: [
          {
            id: "line-1",
            product_id: PRODUCT_ID,
            variant_id: null,
            flavour_id: null,
            egg_eggless: null,
            message: null,
            design_path: null,
            pickup_at: null,
            quantity: 1,
          },
        ],
      }),
      products: q({ data: [{ id: PRODUCT_ID, min_prep_minutes: 720 }] }),
    });
    (client as { rpc?: unknown }).rpc = rpc;
    createClientMock.mockResolvedValue(client as never);

    const state = await placeOrderAction(INITIAL_STATE, checkoutForm());

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/pickup time/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects stale pickup times against the live minimum", async () => {
    const rpc = vi.fn();
    const client = clientFor({
      carts: q({ data: { id: "cart-1" } }),
      cart_items: q({
        data: [
          {
            id: "line-1",
            product_id: PRODUCT_ID,
            variant_id: null,
            flavour_id: null,
            egg_eggless: null,
            message: null,
            design_path: null,
            pickup_at: "2020-01-01T10:00:00.000Z",
            quantity: 1,
          },
        ],
      }),
      products: q({ data: [{ id: PRODUCT_ID, min_prep_minutes: 720 }] }),
    });
    (client as { rpc?: unknown }).rpc = rpc;
    createClientMock.mockResolvedValue(client as never);

    const state = await placeOrderAction(INITIAL_STATE, checkoutForm());

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/too soon/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
describe("transitionOrderAction", () => {
  it("rejects unknown statuses without a database call", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await transitionOrderAction("o1", "shipped");

    expect(state.status).toBe("error");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("maps an illegal jump to a curated message", async () => {
    const client = clientFor({});
    (client as { rpc: ReturnType<typeof vi.fn> }).rpc = vi.fn(async () => ({
      data: null,
      error: { message: "INVALID_TRANSITION", code: "P0001" },
    }));
    createClientMock.mockResolvedValue(client as never);

    const state = await transitionOrderAction("o1", "completed");

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not allowed/);
  });

  it("confirms a valid transition", async () => {
    const client = clientFor({});
    (client as { rpc: ReturnType<typeof vi.fn> }).rpc = vi.fn(async () => ({
      data: { order_id: "o1", status: "confirmed" },
      error: null,
    }));
    createClientMock.mockResolvedValue(client as never);

    const state = await transitionOrderAction("o1", "confirmed");

    expect(state.status).toBe("success");
  });

  it("forwards the paid confirmation when completing", async () => {
    const rpc = vi.fn(async () => ({ data: { order_id: "o1", status: "completed" }, error: null }));
    const client = clientFor({});
    (client as { rpc: unknown }).rpc = rpc;
    createClientMock.mockResolvedValue(client as never);

    const state = await transitionOrderAction("o1", "completed", { paymentReceived: true });

    expect(state.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith(
      "transition_order",
      expect.objectContaining({ p_to_status: "completed", p_payment_received: true }),
    );
  });

  it("asks for payment confirmation when the database requires it", async () => {
    const client = clientFor({});
    (client as { rpc: ReturnType<typeof vi.fn> }).rpc = vi.fn(async () => ({
      data: null,
      error: { message: "PAYMENT_REQUIRED", code: "P0001" },
    }));
    createClientMock.mockResolvedValue(client as never);

    const state = await transitionOrderAction("o1", "completed");

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/payment was received/);
  });
});

describe("notification actions", () => {
  it("scopes reads to the caller's own rows", async () => {
    const update = vi.fn();
    const chain = q({});
    chain.update = update.mockImplementation(() => chain);
    const client = clientFor({});
    (client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    createClientMock.mockResolvedValue(client as never);

    const state = await markNotificationReadAction("n1");

    expect(state.status).toBe("success");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_read: true }));
  });

  it("marks everything read for the caller", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await markAllNotificationsReadAction();

    expect(state.status).toBe("success");
  });

  it("deletes one of the caller's own notifications", async () => {
    const del = vi.fn(() => q({}));
    const client = clientFor({});
    (client.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const chain = q({});
      chain.delete = del.mockImplementation(() => chain);
      return chain;
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteNotificationAction("n1");

    expect(state.status).toBe("success");
    expect(client.from).toHaveBeenCalledWith("notifications");
  });

  it("deletes only read notifications for the caller", async () => {
    const eq = vi.fn(() => q({}));
    const chain = q({});
    chain.delete = vi.fn(() => chain);
    chain.eq = eq.mockImplementation(() => chain);
    const client = clientFor({});
    (client.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteReadNotificationsAction();

    expect(state.status).toBe("success");
    expect(eq).toHaveBeenCalledWith("is_read", true);
  });
});

describe("deleteOrderAction", () => {
  function bundle(overrides: Record<string, unknown> = {}) {
    return {
      id: "o1",
      customerId: "customer-uid",
      status: "completed",
      assets: [],
      ...overrides,
    };
  }

  it("deletes the caller's own completed order and returns to the list", async () => {
    getOrderBundleMock.mockResolvedValue(bundle() as never);
    const rpc = vi.fn(async () => ({ data: { deleted: true }, error: null }));
    const client = clientFor({});
    (client as { rpc: unknown }).rpc = rpc;
    createClientMock.mockResolvedValue(client as never);

    await expect(deleteOrderAction("o1", "/owner/orders")).rejects.toBeInstanceOf(RedirectSignal);

    expect(rpc).toHaveBeenCalledWith("delete_order", { p_order_id: "o1" });
    expect(getOrderBundleMock).toHaveBeenCalledWith("o1", "customer");
    // History replacement: Back must skip the deleted detail page, not 404 on it.
    const { redirect } = await import("next/navigation");
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/owner/orders", "replace");
  });

  it("reads with the owner scope when an owner deletes", async () => {
    getSessionContextMock.mockResolvedValue({
      user: CUSTOMER.user,
      profile: { role: "OWNER", status: "ACTIVE" },
    } as never);
    getOrderBundleMock.mockResolvedValue(bundle() as never);
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    await expect(deleteOrderAction("o1", "/owner/orders")).rejects.toBeInstanceOf(RedirectSignal);

    expect(getOrderBundleMock).toHaveBeenCalledWith("o1", "owner");
  });

  it("refuses an off-site return path", async () => {
    getOrderBundleMock.mockResolvedValue(bundle() as never);
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteOrderAction("o1", "https://evil.example/orders");

    expect(state.status).toBe("error");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("hides foreign orders instead of deleting them", async () => {
    getOrderBundleMock.mockResolvedValue(bundle({ customerId: "someone-else" }) as never);
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteOrderAction("o1", "/owner/orders");

    expect(state.status).toBe("error");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("refuses orders that are not completed", async () => {
    getOrderBundleMock.mockResolvedValue(bundle({ status: "baking" }) as never);
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteOrderAction("o1", "/owner/orders");

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/Only completed orders/);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("reports a missing order without touching the database", async () => {
    getOrderBundleMock.mockResolvedValue(null);
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteOrderAction("o1", "/owner/orders");

    expect(state.status).toBe("error");
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
