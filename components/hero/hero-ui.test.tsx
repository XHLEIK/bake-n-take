import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hero/actions", () => ({
  createHeroItemAction: vi.fn(async () => ({ status: "idle" })),
  updateHeroItemAction: vi.fn(async () => ({ status: "idle" })),
  setHeroStatusAction: vi.fn(async () => ({ status: "success" })),
  moveHeroItemAction: vi.fn(async () => ({ status: "success" })),
  duplicateHeroItemAction: vi.fn(async () => ({ status: "success" })),
  deleteHeroItemAction: vi.fn(async () => ({ status: "success" })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  redirect: vi.fn(),
}));

import { HeroCarousel } from "./hero-carousel";
import { HeroForm } from "./hero-form";
import { HeroRowActions } from "./hero-row-actions";
import { emptyHeroForm } from "@/lib/hero/form-defaults";
import type { HeroSlide } from "@/lib/hero/types";

function slide(overrides: Partial<HeroSlide> = {}): HeroSlide {
  return {
    key: "s1",
    eyebrow: "Fresh from the oven",
    headline: "Freshly Baked, Made for You",
    description: "Cakes and more.",
    cta: "Explore Menu",
    imageUrl: "banners/predefined-bread.jpg",
    href: "/webstore/u1/shop",
    ...overrides,
  };
}

describe("HeroCarousel", () => {
  it("renders slides with headlines and CTAs", () => {
    render(
      <HeroCarousel
        slides={[slide(), slide({ key: "s2", headline: "Make It Yours", cta: "Customize" })]}
      />,
    );

    expect(screen.getByText("Freshly Baked, Made for You")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explore menu/i })).toHaveAttribute(
      "href",
      "/webstore/u1/shop",
    );
    expect(screen.getByRole("tablist", { name: /choose slide/i })).toBeInTheDocument();
  });

  it("renders nothing without slides", () => {
    const { container } = render(<HeroCarousel slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a solid panel when no image is available", () => {
    render(<HeroCarousel slides={[slide({ imageUrl: null })]} />);

    expect(screen.getByText("Freshly Baked, Made for You")).toBeInTheDocument();
  });
});

describe("HeroRowActions", () => {
  it("offers enable/disable, reorder and archive", () => {
    render(<HeroRowActions heroId="h1" effective="active" baseStatus="active" isSystem={false} />);

    expect(screen.getByRole("button", { name: /disable/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /archive/i })).toBeInTheDocument();
  });

  it("hides destructive actions on system slides", () => {
    render(<HeroRowActions heroId="h1" effective="active" baseStatus="active" isSystem />);

    expect(screen.queryByRole("button", { name: /duplicate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});

describe("HeroForm", () => {
  const catalog = { promotions: [], categories: [], products: [], gallery: [] };

  it("shows announcement fields by default", () => {
    render(
      <HeroForm
        mode="create"
        initial={emptyHeroForm()}
        promotions={catalog.promotions}
        categories={catalog.categories}
        products={catalog.products}
        gallery={catalog.gallery}
      />,
    );

    expect(screen.getByLabelText(/^headline$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/offer to feature/i)).not.toBeInTheDocument();
  });

  it("switches to the offer picker for offer slides", async () => {
    const user = userEvent.setup();
    render(
      <HeroForm
        mode="create"
        initial={emptyHeroForm()}
        promotions={[{ id: "p1", name: "Diwali 10", status: "active" }]}
        categories={catalog.categories}
        products={catalog.products}
        gallery={catalog.gallery}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/slide type/i), "offer");

    expect(screen.getByLabelText(/offer to feature/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /diwali 10/i })).toBeInTheDocument();
  });
});
