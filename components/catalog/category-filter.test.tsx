import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CategoryFilter, type CategoryOption } from "./category-filter";

const OPTIONS: CategoryOption[] = [
  { key: "all", label: "All Products", count: 3 },
  { key: "cakes", label: "Cakes", count: 2 },
  { key: "cookies", label: "Cookies", count: 0 },
];

const PANELS = {
  all: <p>All bakes panel</p>,
  cakes: <p>Cakes panel</p>,
  cookies: <p>Cookies empty panel</p>,
};

function renderFilter() {
  return render(<CategoryFilter options={OPTIONS} panels={PANELS} />);
}

describe("CategoryFilter", () => {
  it("starts on All Products with pressed state", () => {
    renderFilter();
    expect(screen.getByRole("button", { name: /all products/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("All bakes panel")).toBeInTheDocument();
  });

  it("filters inline without navigation when a category is chosen", async () => {
    const user = userEvent.setup();
    renderFilter();

    const cakes = screen.getByRole("button", { name: /cakes/i });
    const all = screen.getByRole("button", { name: /all products/i });
    await user.click(cakes);

    expect(cakes).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Cakes panel")).toBeInTheDocument();
    expect(screen.queryByText("All bakes panel")).not.toBeInTheDocument();
    // Nothing inside the island navigates away.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the empty panel for categories without products", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("button", { name: /cookies/i }));
    expect(screen.getByText("Cookies empty panel")).toBeInTheDocument();
  });

  it("labels every tile with its index for orientation", () => {
    renderFilter();
    const group = screen.getByRole("group", { name: /filter products by category/i });
    expect(within(group).getByText("01")).toBeInTheDocument();
    expect(within(group).getByText("02")).toBeInTheDocument();
    expect(within(group).getByText("03")).toBeInTheDocument();
  });
});
