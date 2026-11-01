import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/owner/orders"),
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
}));

import { AdminNav } from "./admin-nav";
import { buildAdminNav, isNavActive, sectionForPath } from "./admin-sections";
import { render, screen, within } from "@testing-library/react";

const UID = "11111111-1111-4111-8111-111111111111";

describe("buildAdminNav", () => {
  it("returns the six destinations in order with real owner routes", () => {
    const items = buildAdminNav(UID);
    expect(items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Orders",
      "Products",
      "Offers",
      "Hero Carousel",
      "Store Settings",
    ]);
    expect(items[0]?.href).toBe(`/owner/${UID}`);
    expect(items.map((item) => item.href)).toEqual([
      `/owner/${UID}`,
      "/owner/orders",
      "/owner/products",
      "/owner/offers",
      "/owner/hero",
      "/owner/settings",
    ]);
  });
});

describe("isNavActive", () => {
  it("matches dashboard exactly, never by prefix", () => {
    const [dashboard] = buildAdminNav(UID);
    expect(isNavActive(`/owner/${UID}`, dashboard!)).toBe(true);
    expect(isNavActive("/owner/orders", dashboard!)).toBe(false);
  });

  it("matches section roots and their subpages, not siblings", () => {
    const items = buildAdminNav(UID);
    const orders = items.find((item) => item.key === "orders")!;
    expect(isNavActive("/owner/orders", orders)).toBe(true);
    expect(isNavActive("/owner/orders/some-id", orders)).toBe(true);
    expect(isNavActive("/owner/products", orders)).toBe(false);
  });
});

describe("sectionForPath", () => {
  it("labels every owner section including deep subpages", () => {
    expect(sectionForPath("/owner")).toBe("Dashboard");
    expect(sectionForPath(`/owner/${UID}`)).toBe("Dashboard");
    expect(sectionForPath("/owner/orders")).toBe("Orders");
    expect(sectionForPath("/owner/orders/abc")).toBe("Orders");
    expect(sectionForPath("/owner/products/new")).toBe("Products");
    expect(sectionForPath("/owner/offers/abc")).toBe("Offers");
    expect(sectionForPath("/owner/hero/new")).toBe("Hero Carousel");
    expect(sectionForPath("/owner/settings")).toBe("Store Settings");
  });

  it("returns null outside the shell", () => {
    expect(sectionForPath("/owner/login")).toBeNull();
    expect(sectionForPath("/login")).toBeNull();
    expect(sectionForPath(`/webstore/${UID}`)).toBeNull();
  });
});

describe("AdminNav", () => {
  it("marks only the current destination with aria-current", () => {
    const items = buildAdminNav(UID);
    render(<AdminNav items={items} />);
    const nav = screen.getByRole("navigation", { name: "Admin" });
    const current = within(nav).getByRole("link", { current: "page" });
    expect(current).toHaveAttribute("href", "/owner/orders");
    expect(current).toHaveTextContent("Orders");
    expect(within(nav).getAllByRole("link")).toHaveLength(6);
  });
});
