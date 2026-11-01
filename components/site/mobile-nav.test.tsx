import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/webstore/u1"),
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
}));

vi.mock("@/lib/actions/auth", () => ({
  signOutAction: vi.fn(),
}));

import { MobileNav } from "./mobile-nav";

const LINKS = [
  { href: "/webstore/u1", label: "Home" },
  { href: "/webstore/u1/shop", label: "Bake list" },
  { href: "/webstore/u1/cart", label: "Cart" },
];

describe("MobileNav", () => {
  it("renders only the trigger until opened", () => {
    render(<MobileNav links={LINKS} session={null} />);
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Closed overlay is present but hidden from assistive tech.
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });

  it("portals the open drawer to document.body so header styles cannot trap it", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div data-testid="header-stub">
        <MobileNav links={LINKS} session={null} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const dialog = screen.getByRole("dialog", { name: "Menu" });
    // Viewport-anchored: the dialog must live on <body>, never inside the
    // header subtree whose backdrop blur would clip it to 64px.
    expect(dialog.closest('[data-testid="header-stub"]')).toBeNull();
    expect(document.body.contains(dialog)).toBe(true);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    for (const link of LINKS) {
      expect(within(dialog).getByRole("link", { name: link.label })).toHaveAttribute(
        "href",
        link.href,
      );
    }
  });

  it("closes on Escape and restores body scroll locking exactly", async () => {
    const user = userEvent.setup();
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    render(<MobileNav links={LINKS} session={null} />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });
});
