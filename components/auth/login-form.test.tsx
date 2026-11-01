import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

/**
 * The Server Action is replaced with a spy: this suite is about the form's
 * markup, accessibility wiring and states, not about authentication logic
 * (which is covered by lib/actions/auth.*.test.ts).
 */
vi.mock("@/lib/actions/auth", () => ({
  signInAction: vi.fn(),
  signInWithOAuthAction: vi.fn(),
}));

describe("LoginForm", () => {
  it("labels every control and keeps the deep-link target in the form", () => {
    render(<LoginForm next="/customer/orders" />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");

    const hidden = document.querySelector<HTMLInputElement>('input[name="next"]');
    expect(hidden?.value).toBe("/customer/orders");
  });

  it("shows both social providers as real, labelled buttons", () => {
    render(<LoginForm />);

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with facebook/i })).toBeInTheDocument();

    expect(document.querySelector('input[name="provider"][value="google"]')).toBeTruthy();
    expect(document.querySelector('input[name="provider"][value="facebook"]')).toBeTruthy();
  });

  it("reveals and hides the password on request", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("renders the reason it was reached from a redirect", () => {
    render(<LoginForm initialError="Your session has ended. Please sign in again to continue." />);

    expect(screen.getByRole("alert")).toHaveTextContent(/session has ended/i);
  });

  it("marks the owner entrance as owner-only", () => {
    render(<LoginForm requireOwner />);

    expect(document.querySelector('input[name="requireOwner"]')?.getAttribute("value")).toBe("1");
  });

  it("can be completed with the keyboard alone, in a sensible order", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.tab();
    expect(screen.getByLabelText("Email")).toHaveFocus();

    await user.keyboard("baker@example.com");
    await user.tab();
    expect(screen.getByLabelText("Password")).toHaveFocus();

    await user.keyboard("sourdough1");
    await user.tab();
    expect(screen.getByRole("button", { name: /show password/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toHaveFocus();
  });
});
