import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Product } from "@/lib/catalog/types";

vi.mock("@/lib/catalog/actions", () => ({
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
  deleteProductAction: vi.fn(),
  setProductArchivedAction: vi.fn(),
  uploadCustomerDesignAction: vi.fn(),
  removeCustomerDesignAction: vi.fn(),
}));

vi.mock("@/lib/catalog/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog/repository")>();
  return { ...actual, catalogAssetUrl: (path: string | null) => path };
});

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  redirect: vi.fn(),
}));

import { Configurator } from "./configurator";
import {
  FlavourRows,
  VariantRows,
  newFlavourRow,
  newVariantRow,
  type FlavourDraft,
  type VariantDraft,
} from "./option-editors";
import { ProductForm } from "./product-form";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "chocolate-cake",
    name: "Chocolate Cake",
    shortDescription: "Rich.",
    description: "Fresh daily.",
    basePricePaise: 60000,
    categoryId: "c1",
    categoryName: "Cakes",
    categorySlug: "cakes",
    variantMode: "size",
    isActive: true,
    archivedAt: null,
    isFeatured: false,
    isTrending: false,
    isNew: false,
    newUntil: null,
    heroFeatured: false,
    allowCustomDesign: false,
    eggEgglessEnabled: true,
    egglessSurchargePaise: 5000,
    messageEnabled: true,
    minPrepMinutes: 720,
    displayOrder: 1,
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
      {
        id: "v2",
        label: "2 Pound",
        value: null,
        pricePaise: 110000,
        isActive: true,
        displayOrder: 1,
      },
    ],
    flavours: [
      { id: "f1", name: "Chocolate", surchargePaise: 0, isActive: true, displayOrder: 0 },
      { id: "f2", name: "Ferrero", surchargePaise: 15000, isActive: true, displayOrder: 1 },
    ],
    ...overrides,
  };
}

const money = { currency: "INR", currencySymbol: "₹" };

describe("VariantRows / FlavourRows", () => {
  it("adds and removes variant rows with stable keys", async () => {
    const user = userEvent.setup();
    let rows: VariantDraft[] = [];
    const onChange = vi.fn((next: VariantDraft[]) => {
      rows = next;
      rerender(<VariantRows rows={rows} onChange={onChange} />);
    });
    const { rerender } = render(<VariantRows rows={rows} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add option/i }));
    expect(rows).toHaveLength(1);
    const key = rows[0].key;

    await user.type(screen.getByLabelText("Option 1 label"), "1 Pound");
    expect(rows[0]).toMatchObject({ label: "1 Pound", id: null });
    expect(rows[0].key).toBe(key);

    await user.click(screen.getByRole("button", { name: /remove option 1/i }));
    expect(rows).toEqual([]);
  });

  it("adds flavour rows", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FlavourRows rows={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add flavour/i }));
    const added = onChange.mock.calls[0][0] as FlavourDraft[];
    expect(added[0]).toMatchObject({ name: "", surchargeRupees: "", isActive: true });
  });

  it("exposes row factories with unique keys", () => {
    expect(newVariantRow().key).not.toBe(newVariantRow().key);
    expect(newFlavourRow().key).not.toBe(newFlavourRow().key);
  });
});

describe("ProductForm", () => {
  const categories = [{ id: "c1", name: "Cakes" }];

  it("renders every section for a new product", () => {
    render(<ProductForm mode="create" product={null} categories={categories} />);

    for (const heading of [
      "Basic information",
      "Media",
      "Pricing and variants",
      "Flavours",
      "Customization",
      "Merchandising",
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /create product/i })).toBeInTheDocument();
  });

  it("offers no category to pick when none exists yet", () => {
    render(<ProductForm mode="create" product={null} categories={[]} />);

    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
  });

  it("prefills an existing product and tracks edits", async () => {
    const user = userEvent.setup();
    render(<ProductForm mode="edit" product={product()} categories={categories} />);

    expect(screen.getByLabelText("Product name")).toHaveValue("Chocolate Cake");
    await user.clear(screen.getByLabelText("Product name"));
    await user.type(screen.getByLabelText("Product name"), "Dark Chocolate Cake");
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
  });
});

describe("Configurator", () => {
  it("previews variant + flavour + eggless totals from database prices", async () => {
    const user = userEvent.setup();
    render(<Configurator product={product()} money={money} webstoreUid="uid-1" hours={null} />);

    // Default: 1 Pound + Chocolate + egg = ₹600 (option price and total match).
    expect(screen.getAllByText("₹600.00")).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: /2 pound/i }));
    await user.click(screen.getByRole("radio", { name: /ferrero/i }));
    await user.click(screen.getByRole("radio", { name: /eggless/i }));

    // 110000 + 15000 + 5000 paise = ₹1,300.
    expect(screen.getByText("₹1,300.00")).toBeInTheDocument();
    expect(screen.getByText(/2 pound · ferrero · eggless/i)).toBeInTheDocument();
  });

  it("shows the base price when nothing applies", () => {
    render(
      <Configurator
        product={product({ variants: [], flavours: [], eggEgglessEnabled: false })}
        money={money}
        webstoreUid="uid-1"
        hours={null}
      />,
    );

    expect(screen.getByText("₹600.00")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: /flavours/i })).not.toBeInTheDocument();
  });
  it("reveals the design upload only when the owner enabled it", () => {
    const { rerender } = render(
      <Configurator product={product()} money={money} webstoreUid="uid-1" hours={null} />,
    );
    expect(screen.queryByText(/custom design/i)).not.toBeInTheDocument();

    rerender(
      <Configurator
        product={product({ allowCustomDesign: true })}
        money={money}
        webstoreUid="uid-1"
        hours={null}
      />,
    );
    expect(screen.getByText(/custom design/i)).toBeInTheDocument();
  });
});
