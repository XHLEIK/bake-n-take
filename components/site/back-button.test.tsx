import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/webstore/u1/shop"),
  useRouter: vi.fn(() => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() })),
}));

import { usePathname, useRouter } from "next/navigation";

import { BackButton } from "./back-button";

const mockPathname = vi.mocked(usePathname);
const mockRouter = vi.mocked(useRouter);

describe("BackButton", () => {
  it("renders nothing on home screens", () => {
    for (const home of [
      "/",
      "/webstore/u1",
      "/webstore/u1/",
      "/owner/123e4567-e89b-12d3-a456-426614174000",
    ]) {
      mockPathname.mockReturnValue(home);
      const { unmount } = render(<BackButton fallbackHref="/webstore/u1" />);
      expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
      unmount();
    }
  });

  it("renders on inner screens, including owner sub-pages", () => {
    for (const path of [
      "/webstore/u1/shop",
      "/webstore/u1/cart",
      "/owner/orders",
      "/owner/products",
      "/owner/settings",
      "/login",
    ]) {
      mockPathname.mockReturnValue(path);
      const { unmount } = render(<BackButton fallbackHref="/webstore/u1" />);
      expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
      unmount();
    }
  });

  it("falls back to the storefront home on direct entry", async () => {
    // Fresh jsdom history has a single entry: nowhere to go back to.
    mockPathname.mockReturnValue("/webstore/u1/shop");
    const push = vi.fn();
    mockRouter.mockReturnValue({ back: vi.fn(), push, refresh: vi.fn() } as never);
    const user = userEvent.setup();
    render(<BackButton fallbackHref="/webstore/u1" />);

    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(push).toHaveBeenCalledWith("/webstore/u1");
  });

  it("goes back when history exists", async () => {
    mockPathname.mockReturnValue("/webstore/u1/shop");
    window.history.pushState({}, "", "/webstore/u1/shop");
    window.history.pushState({}, "", "/webstore/u1/shop/cake");
    const back = vi.fn();
    const push = vi.fn();
    mockRouter.mockReturnValue({ back, push, refresh: vi.fn() } as never);
    const user = userEvent.setup();
    render(<BackButton fallbackHref="/webstore/u1" />);

    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
});
