/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedirectSignal } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/auth/session", () => ({
  requireOwner: vi.fn(),
  requireUser: vi.fn(),
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
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwner, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import {
  createCategoryAction,
  createProductAction,
  deleteCategoryAction,
  deleteProductAction,
  removeCustomerDesignAction,
  setProductActiveAction,
  uploadCustomerDesignAction,
} from "./actions";

const requireOwnerMock = vi.mocked(requireOwner);
const requireUserMock = vi.mocked(requireUser);
const createClientMock = vi.mocked(createClient);
const updateTagMock = vi.mocked(updateTag);
const redirectMock = vi.mocked(redirect);

const INITIAL_STATE = { status: "idle" as const };
const OWNER_SESSION = { user: { id: "owner-id" }, profile: { role: "OWNER", status: "ACTIVE" } };
const CUSTOMER_SESSION = {
  user: { id: "customer-uid" },
  profile: { role: "CUSTOMER", status: "ACTIVE" },
};

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

/** Chainable query double: awaiting it resolves to its own result fields. */
function q(result: Record<string, unknown> = {}) {
  const chainable: Record<string, unknown> = { data: null, error: null, count: 0, ...result };
  for (const method of [
    "select",
    "eq",
    "ilike",
    "is",
    "not",
    "order",
    "limit",
    "or",
    "update",
    "insert",
    "delete",
    "maybeSingle",
  ]) {
    chainable[method] = vi.fn(() => chainable);
  }
  return chainable;
}

function clientFor(
  tables: Record<string, ReturnType<typeof q>>,
  storage?: {
    upload?: unknown;
    remove?: unknown;
  },
) {
  return {
    from: vi.fn((table: string) => tables[table] ?? q()),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({})),
        ...(storage ?? {}),
      })),
    },
  };
}

function categoryForm(overrides: Record<string, string> = {}): FormData {
  return form({
    name: "Birthday Cakes",
    description: "Celebration range.",
    displayOrder: "2",
    isActive: "1",
    imageRemoved: "0",
    ...overrides,
  });
}

function productForm(overrides: Record<string, string> = {}): FormData {
  return form({
    name: "Chocolate Cake",
    shortDescription: "Rich.",
    description: "Fresh daily.",
    basePriceRupees: "600",
    categoryId: "11111111-1111-4111-8111-111111111111",
    variantMode: "size",
    variantsJson: JSON.stringify([
      { id: "", label: "1 Pound", value: "", priceRupees: "600", isActive: true },
    ]),
    flavoursJson: JSON.stringify([
      { id: "", name: "Ferrero", surchargeRupees: "150", isActive: true },
    ]),
    isActive: "1",
    isFeatured: "1",
    isTrending: "0",
    allowCustomDesign: "0",
    eggEgglessEnabled: "0",
    egglessSurchargeRupees: "",
    messageEnabled: "0",
    displayOrder: "1",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerMock.mockResolvedValue(OWNER_SESSION as never);
  requireUserMock.mockResolvedValue(CUSTOMER_SESSION as never);
});

describe("catalog authorization", () => {
  it("bounces non-owners before touching the database", async () => {
    requireOwnerMock.mockRejectedValueOnce(new RedirectSignal("/owner/login"));
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    await expect(createCategoryAction(INITIAL_STATE, categoryForm())).rejects.toBeInstanceOf(
      RedirectSignal,
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it("bounces non-owners from product creation", async () => {
    requireOwnerMock.mockRejectedValueOnce(new RedirectSignal("/owner/login"));
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    await expect(createProductAction(INITIAL_STATE, productForm())).rejects.toBeInstanceOf(
      RedirectSignal,
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("createCategoryAction", () => {
  it("creates with a generated slug and confirms", async () => {
    const client = clientFor({});
    (client.from as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => q({ data: [{ id: "c9", slug: "other" }] }))
      .mockImplementationOnce(() => q({ data: { id: "c-new" } }));
    createClientMock.mockResolvedValue(client as never);

    const state = await createCategoryAction(INITIAL_STATE, categoryForm());

    expect(state.status).toBe("success");
    expect(updateTagMock).toHaveBeenCalledWith("catalog");
  });

  it("reports validation failures without writing", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await createCategoryAction(INITIAL_STATE, categoryForm({ name: "  " }));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.name).toBeTruthy();
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("deleteCategoryAction", () => {
  it("deletes the category while its products become uncategorized", async () => {
    const client = clientFor({
      categories: q({ data: { id: "c1" } }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteCategoryAction("c1");

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/uncategorized/i);
    expect(updateTagMock).toHaveBeenCalledWith("catalog");
  });

  it("reports a missing category", async () => {
    const client = clientFor({
      categories: q({ data: null }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await deleteCategoryAction("c1");

    expect(state.status).toBe("error");
  });
});

describe("createProductAction", () => {
  it("rejects bad prices before writing", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await createProductAction(
      INITIAL_STATE,
      productForm({ basePriceRupees: "10.999" }),
    );

    expect(state.status).toBe("error");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects unknown category and type references", async () => {
    const client = clientFor({
      categories: q({ data: null }),
    });
    createClientMock.mockResolvedValue(client as never);

    const state = await createProductAction(INITIAL_STATE, productForm());

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/category/i);
  });

  it("creates the product with children and redirects to edit", async () => {
    const productsMock = vi
      .fn()
      .mockImplementationOnce(() => q({ data: [] }))
      .mockImplementationOnce(() => q({ data: { id: "p-new" } }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "products") return productsMock();
        if (table === "categories")
          return q({ data: { id: "11111111-1111-4111-8111-111111111111" } });
        return q({ data: [] });
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
          remove: vi.fn(async () => ({})),
        })),
      },
    };
    createClientMock.mockResolvedValue(client as never);

    await expect(createProductAction(INITIAL_STATE, productForm())).rejects.toBeInstanceOf(
      RedirectSignal,
    );
    expect(redirectMock).toHaveBeenCalledWith("/owner/products/p-new");
    expect(updateTagMock).toHaveBeenCalledWith("catalog");
  });
});

describe("setProductActiveAction", () => {
  it("toggles availability and revalidates", async () => {
    const client = clientFor({ products: q({}) });
    createClientMock.mockResolvedValue(client as never);

    const state = await setProductActiveAction("p1", false);

    expect(state.status).toBe("success");
    expect(updateTagMock).toHaveBeenCalledWith("catalog");
  });
});

describe("deleteProductAction", () => {
  it("removes the row, retires files and redirects to the list", async () => {
    const remove = vi.fn(async () => ({}));
    const client = clientFor(
      { product_images: q({ data: [{ storage_path: "products/p1/a.png" }] }) },
      { remove },
    );
    createClientMock.mockResolvedValue(client as never);

    await expect(deleteProductAction("p1")).rejects.toBeInstanceOf(RedirectSignal);

    expect(remove).toHaveBeenCalledWith(["products/p1/a.png"]);
    expect(redirectMock).toHaveBeenCalledWith("/owner/products");
  });
});

describe("customer design drafts", () => {
  it("refuses an empty upload", async () => {
    const client = clientFor({});
    createClientMock.mockResolvedValue(client as never);

    const state = await uploadCustomerDesignAction({ status: "idle" }, new FormData());

    expect(state.status).toBe("error");
  });

  it("refuses to delete another account's draft", async () => {
    const remove = vi.fn(async () => ({}));
    const client = clientFor({}, { remove });
    createClientMock.mockResolvedValue(client as never);

    const state = await removeCustomerDesignAction("tmp/someone-else/x.png");

    expect(state.status).toBe("error");
    expect(remove).not.toHaveBeenCalled();
  });
});
