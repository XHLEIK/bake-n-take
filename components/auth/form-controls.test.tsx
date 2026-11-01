import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FormField } from "./form-field";
import { InlineMessage } from "./inline-message";
import { PasswordHints } from "./password-hints";

describe("PasswordHints", () => {
  it("reports each rule as met or not met, in text as well as colour", () => {
    const { rerender } = render(<PasswordHints value="" />);

    const rule = (label: string) => screen.getByText(label).closest("li")?.textContent ?? "";
    expect(rule("8+ characters")).toMatch(/not met yet/i);
    expect(rule("One letter")).toMatch(/not met yet/i);
    expect(rule("One number")).toMatch(/not met yet/i);

    rerender(<PasswordHints value="sourdough1" />);

    expect(rule("8+ characters")).toMatch(/— met/i);
    expect(rule("One letter")).toMatch(/— met/i);
    expect(rule("One number")).toMatch(/— met/i);
  });
});

describe("FormField", () => {
  it("associates the label, the hint and the error with the input", () => {
    render(
      <FormField
        label="Email"
        name="email"
        type="email"
        hint="We never share it."
        error="Enter a valid email address."
      />,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("email-hint");
    expect(describedBy).toContain("email-error");

    expect(screen.getByText("We never share it.")).toHaveAttribute("id", "email-hint");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });

  it("omits error wiring when there is no error", () => {
    render(<FormField label="Email" name="email" type="email" />);

    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("supports a trailing control inside the field", async () => {
    const user = userEvent.setup();
    render(
      <FormField
        label="Password"
        name="password"
        type="password"
        trailing={<button type="button">Toggle</button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.getByRole("button", { name: "Toggle" })).toBeEnabled();
  });
});

describe("InlineMessage", () => {
  it("announces errors assertively and successes politely", () => {
    const { rerender } = render(<InlineMessage variant="error" message="Something is wrong." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something is wrong.");

    rerender(<InlineMessage variant="success" message="All done." />);
    expect(screen.getByRole("status")).toHaveTextContent("All done.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
