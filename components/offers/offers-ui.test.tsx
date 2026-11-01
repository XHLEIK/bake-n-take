import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/promotions/actions", () => ({
  createPromotionAction: vi.fn(async () => ({ status: "idle" })),
  updatePromotionAction: vi.fn(async () => ({ status: "idle" })),
  applyCouponAction: vi.fn(async () => ({ status: "success" })),
  removeCouponAction: vi.fn(async () => ({ status: "success" })),
  setPromotionStatusAction: vi.fn(async () => ({ status: "success" })),
  duplicatePromotionAction: vi.fn(async () => ({ status: "success" })),
  deletePromotionAction: vi.fn(async () => ({ status: "success" })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  redirect: vi.fn(),
}));

import { applyCouponAction, removeCouponAction } from "@/lib/promotions/actions";

import { OfferBanner } from "./offer-banner";
import { CouponForm } from "./coupon-form";
import { OfferRowActions } from "./offer-row-actions";
import { OfferStatusBadge } from "./offer-status-badge";
import { OfferForm } from "./offer-form";
import { emptyOfferForm } from "@/lib/promotions/form-defaults";

describe("OfferBanner", () => {
  it("renders content with a call to action", () => {
    render(
      <OfferBanner
        header="SUMMER SPECIAL"
        title="Any 2 Cupcakes for ₹150"
        description="Mix and match."
        ctaLabel="Shop now"
        style="ember"
        imageUrl={null}
      />,
    );

    expect(screen.getByText("SUMMER SPECIAL")).toBeInTheDocument();
    expect(screen.getByText("Shop now")).toBeInTheDocument();
  });
});

describe("OfferStatusBadge", () => {
  it("labels every effective status", () => {
    const { rerender } = render(<OfferStatusBadge status="scheduled" />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    rerender(<OfferStatusBadge status="expired" />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });
});

describe("CouponForm", () => {
  it("applies a code from the input", async () => {
    const user = userEvent.setup();
    render(<CouponForm currentCode={null} coupon={null} />);

    await user.type(screen.getByLabelText(/coupon code/i), "summer50");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(applyCouponAction).toHaveBeenCalledWith("summer50");
  });

  it("shows validity and removes the saved code", async () => {
    const user = userEvent.setup();
    render(
      <CouponForm
        currentCode="SUMMER50"
        coupon={{ valid: false, message: "That coupon is not valid for this order." }}
      />,
    );

    expect(screen.getByText("SUMMER50")).toBeInTheDocument();
    expect(screen.getByText(/not valid for this order/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(removeCouponAction).toHaveBeenCalled();
  });
});

describe("OfferRowActions", () => {
  it("offers pause and archive on active offers", () => {
    render(
      <OfferRowActions
        promotionId="p1"
        effective="active"
        baseStatus="active"
        hasRedemptions={false}
      />,
    );

    expect(screen.getByRole("button", { name: /^pause$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /archive/i })).toBeInTheDocument();
    // Draft-only delete stays hidden on active offers.
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("offers delete on clean drafts", () => {
    render(
      <OfferRowActions
        promotionId="p1"
        effective="draft"
        baseStatus="draft"
        hasRedemptions={false}
      />,
    );

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});

describe("OfferForm", () => {
  const catalog = { categories: [], products: [], gallery: [] };

  it("shows percentage fields by default", () => {
    render(
      <OfferForm
        mode="create"
        initial={emptyOfferForm()}
        categories={catalog.categories}
        products={catalog.products}
        gallery={catalog.gallery}
      />,
    );

    expect(screen.getByLabelText(/percent off/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/buy quantity/i)).not.toBeInTheDocument();
  });

  it("switches to bundle fields for mix and match", async () => {
    const user = userEvent.setup();
    render(
      <OfferForm
        mode="create"
        initial={emptyOfferForm()}
        categories={catalog.categories}
        products={catalog.products}
        gallery={catalog.gallery}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/offer type/i), "mix_match");

    expect(screen.getByLabelText(/bundle size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bundle price/i)).toBeInTheDocument();
  });

  it("suggests the banner title from the discount setup", async () => {
    const user = userEvent.setup();
    render(
      <OfferForm
        mode="create"
        initial={emptyOfferForm()}
        categories={catalog.categories}
        products={catalog.products}
        gallery={catalog.gallery}
      />,
    );

    // Default 10% suggestion from the untouched form.
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Get 10% OFF");
    // Typing keeps the owner's own words afterwards.
    await user.clear(screen.getByLabelText(/^title$/i));
    await user.type(screen.getByLabelText(/^title$/i), "Diwali Dhamaka");
    await user.clear(screen.getByLabelText(/percent off/i));
    await user.type(screen.getByLabelText(/percent off/i), "25");
    expect(screen.getByLabelText(/^title$/i)).toHaveValue("Diwali Dhamaka");
  });

  it("explains what a coupon code will do", async () => {
    const user = userEvent.setup();
    render(
      <OfferForm
        mode="create"
        initial={emptyOfferForm()}
        categories={catalog.categories}
        products={catalog.products}
        gallery={catalog.gallery}
      />,
    );

    await user.type(screen.getByLabelText(/code \(/i), "save20");

    expect(screen.getByText(/will give customers: 10% off/i)).toBeInTheDocument();
  });

  it("has no destination section — banners link from targeting", () => {
    render(
      <OfferForm
        mode="create"
        initial={emptyOfferForm()}
        categories={catalog.categories}
        products={catalog.products}
        gallery={catalog.gallery}
      />,
    );

    expect(screen.queryByText(/banner destination/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/goes to/i)).not.toBeInTheDocument();
  });
});
