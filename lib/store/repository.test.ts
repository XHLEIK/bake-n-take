/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = {
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn(() => queryMock) })),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

import { formatAddress, getStoreSettings } from "./repository";

function chain(result: { data: unknown; error: unknown }) {
  queryMock.select.mockReturnValue(queryMock);
  queryMock.eq.mockReturnValue(queryMock);
  queryMock.maybeSingle.mockResolvedValue(result);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStoreSettings", () => {
  it("returns the mapped singleton row", async () => {
    chain({ data: { id: 1, store_name: "Bake n Take", country: "India" }, error: null });

    const settings = await getStoreSettings();

    expect(settings?.storeName).toBe("Bake n Take");
    expect(queryMock.eq).toHaveBeenCalledWith("id", 1);
  });

  it("resolves to null on database errors and missing rows", async () => {
    chain({ data: null, error: { message: "boom" } });
    await expect(getStoreSettings()).resolves.toBeNull();

    chain({ data: null, error: null });
    await expect(getStoreSettings()).resolves.toBeNull();
  });

  it("resolves to null when the row fails mapping", async () => {
    chain({ data: { id: 1, store_name: "   " }, error: null });
    await expect(getStoreSettings()).resolves.toBeNull();
  });

  it("falls back without the about column when the migration is unapplied", async () => {
    queryMock.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42703", message: "column store_settings.about does not exist" },
      })
      .mockResolvedValueOnce({
        data: { id: 1, store_name: "Bake n Take", country: "India" },
        error: null,
      });

    const settings = await getStoreSettings();

    expect(settings?.storeName).toBe("Bake n Take");
    // About degrades to compiled defaults instead of taking the page offline.
    expect(settings?.about.enabled).toBe(true);
    expect(settings?.about.heading).toBe("Made fresh, shared with love.");
    const retryColumns = queryMock.select.mock.calls[1][0] as string;
    expect(retryColumns).not.toContain("about");
  });

  it("does not retry other database errors", async () => {
    queryMock.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(getStoreSettings()).resolves.toBeNull();
    expect(queryMock.select).toHaveBeenCalledTimes(1);
  });
});

describe("formatAddress", () => {
  it("joins the parts that exist and skips the rest", () => {
    expect(
      formatAddress({
        addressLine1: "12 Baker Street",
        addressLine2: null,
        locality: "Bandra West",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400050",
        country: "India",
      }),
    ).toBe("12 Baker Street, Bandra West, Mumbai Maharashtra 400050, India");
  });

  it("returns null when nothing is configured", () => {
    expect(
      formatAddress({
        addressLine1: null,
        addressLine2: null,
        locality: null,
        city: null,
        state: null,
        postalCode: null,
        country: "",
      }),
    ).toBeNull();
  });
});
