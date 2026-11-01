import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FilterMenu } from "./filter-menu";

const SECTIONS = [
  {
    heading: "Category",
    links: [
      { href: "/webstore/u1/shop", label: "All products", active: true },
      { href: "/webstore/u1/shop?category=cakes", label: "Cakes", active: false },
    ],
  },
  {
    heading: "Sort by",
    links: [
      { href: "/webstore/u1/shop", label: "Featured", active: false },
      { href: "/webstore/u1/shop?sort=price-asc", label: "Price: Low to High", active: true },
    ],
  },
];

describe("FilterMenu", () => {
  it("stays closed until the pill is pressed", () => {
    render(<FilterMenu label="Category" icon={<span />} sections={SECTIONS} />);
    const pill = screen.getByRole("button", { name: "Category" });
    expect(pill).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Cakes" })).toBeNull();
  });

  it("opens grouped sections, marks active options, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<FilterMenu label="Category" icon={<span />} sections={SECTIONS} />);

    await user.click(screen.getByRole("button", { name: "Category" }));
    expect(screen.getByRole("button", { name: "Category" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Sort by")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cakes" })).toHaveAttribute(
      "href",
      "/webstore/u1/shop?category=cakes",
    );
    expect(screen.getByRole("link", { name: "All products" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Cakes" })).toBeNull();
  });

  it("closes the previously open menu when another opens", async () => {
    const user = userEvent.setup();
    render(
      <>
        <FilterMenu label="First" icon={<span />} sections={SECTIONS} />
        <FilterMenu label="Second" icon={<span />} sections={SECTIONS} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "First" }));
    expect(screen.getAllByRole("link", { name: "Cakes" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Second" }));
    expect(screen.getAllByRole("link", { name: "Cakes" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Second" })).toHaveAttribute("aria-expanded", "true");
  });
});
