import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_COOKIE } from "@/lib/theme";

import { ThemeToggle } from "./theme-toggle";

function stubMatchMedia(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: prefersDark,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
  });

  it("renders the theme from the server so it cannot flicker", () => {
    stubMatchMedia(false);
    render(<ThemeToggle initialTheme="dark" />);

    expect(screen.getByRole("button", { name: /theme: dark/i })).toBeInTheDocument();
  });

  it("cycles light → dark → system and persists each choice in a cookie", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeToggle initialTheme="light" />);

    await user.click(screen.getByRole("button", { name: /switch to dark/i }));
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    await user.click(screen.getByRole("button", { name: /switch to system/i }));
    expect(document.cookie).toContain(`${THEME_COOKIE}=system`);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(screen.getByRole("button", { name: /switch to light/i }));
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the operating system when system is selected", async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    render(<ThemeToggle initialTheme="light" />);

    await user.click(screen.getByRole("button", { name: /switch to dark/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(screen.getByRole("button", { name: /switch to system/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("is reachable and operable from the keyboard", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeToggle initialTheme="system" />);

    await user.tab();
    const button = screen.getByRole("button");
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
  });
});
