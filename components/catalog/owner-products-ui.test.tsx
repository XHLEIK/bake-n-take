import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Category, Product } from "@/lib/catalog/types";

vi.mock("@/lib/catalog/actions", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  setProductActiveAction: vi.fn(),
  setProductArchivedAction: vi.fn(),
  deleteProductAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
  usePathname: vi.fn(() => "/owner/products"),
  redirect: vi.fn(),
}));

import { CategoryManager } from "./category-manager";
import {
  OwnerProductGrid,
  OwnerProductList,
  ProductViewToggle,
} from "@/app/(area)/owner/products/product-views";

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "c1",
    name: "Cakes",
    slug: "cakes",
    updatedAt: null,
    productCount: 2,
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "truffle-cake",
    name: "Truffle Cake",
    shortDescription: "",
    description: "",
    basePricePaise: 60000,
    categoryId: "c1",
    categoryName: "Cakes",
    categorySlug: "cakes",
    variantMode: "size",
    isActive: true,
    archivedAt: null,
    isFeatured: true,
    isTrending: false,
    isNew: false,
    newUntil: null,
    heroFeatured: false,
    allowCustomDesign: false,
    eggEgglessEnabled: false,
    egglessSurchargePaise: 0,
    messageEnabled: false,
    minPrepMinutes: 720,
    displayOrder: 0,
    updatedAt: null,
    images: [],
    variants: [
      {
        id: "v1",
        label: "1 Pound",
        value: null,
        pricePaise: 60000,
        isActive: true,
        displayOrder: 0,
      },
    ],
    flavours: [],
    ...overrides,
  };
}

const money = { currency: "INR", currencySymbol: "₹" };

describe("CategoryManager", () => {
  it("ships collapsed when categories exist, keeping every action reachable", async () => {
    const user = userEvent.setup();
    render(<CategoryManager categories={[category()]} />);

    const toggle = screen.getByRole("button", { name: /categories/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent(/1 categor/);

    // The create form is inert until expanded.
    expect(document.getElementById("category-manager-panel")).toHaveAttribute("inert");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("New category name")).toBeVisible();
    expect(screen.getByRole("button", { name: /^add$/i })).toBeVisible();

    // Compact rows: name + count, slug out of the visual hierarchy.
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Cakes")).toBeInTheDocument();
    expect(within(row).getByText(/2 products/)).toBeInTheDocument();
    expect(within(row).queryByText("/cakes")).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Rename Cakes" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Delete Cakes" })).toBeInTheDocument();
  });

  it("opens automatically when there is nothing to manage yet", () => {
    render(<CategoryManager categories={[]} />);
    expect(screen.getByRole("button", { name: /categories/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(/no categories yet/i)).toBeInTheDocument();
  });
});

describe("OwnerProductGrid", () => {
  it("renders image-first cards with one product link, price and badges", () => {
    render(<OwnerProductGrid products={[product()]} money={money} />);

    // Exactly one accessible link per card so assistive tech and tests
    // resolve the product destination unambiguously.
    const links = screen.getAllByRole("link", { name: "Truffle Cake" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/owner/products/p1");

    expect(screen.getByText("From ₹600.00")).toBeInTheDocument();
    expect(screen.getByText(/cakes · 1 option · 0 flavours/i)).toBeInTheDocument();
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.queryByText("/truffle-cake")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark unavailable" })).toBeInTheDocument();
  });

  it("marks uncategorized, unavailable and archived products in words", () => {
    render(
      <OwnerProductGrid
        products={[
          product({ id: "p2", categoryId: null, categoryName: "", isActive: false }),
          product({ id: "p3", archivedAt: "2026-01-01T00:00:00Z" }),
        ]}
        money={money}
      />,
    );
    expect(screen.getByText(/uncategorized/i)).toBeInTheDocument();
    // Badge plus the availability toggle's screen-reader text.
    expect(screen.getAllByText("Unavailable")).toHaveLength(2);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});

describe("OwnerProductList", () => {
  it("renders compact rows with price and quick actions", () => {
    render(<OwnerProductList products={[product()]} money={money} />);

    expect(screen.getAllByRole("link", { name: "Truffle Cake" })).toHaveLength(1);
    expect(screen.getByText("From ₹600.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit product" })).toHaveAttribute(
      "href",
      "/owner/products/p1",
    );
    expect(screen.getByRole("button", { name: "Archive product" })).toBeInTheDocument();
  });
});

describe("ProductViewToggle", () => {
  it("marks the current display mode as pressed", () => {
    render(<ProductViewToggle view="grid" gridHref="?view=grid" listHref="?view=list" />);
    expect(screen.getByRole("link", { name: /grid/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /list/i })).toHaveAttribute("aria-pressed", "false");
  });
});
