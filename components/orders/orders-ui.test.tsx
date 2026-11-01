import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/orders/actions", () => ({
  updateCartItemQuantityAction: vi.fn(async () => ({ status: "success", cartUnitCount: 1 })),
  removeCartItemAction: vi.fn(async () => ({ status: "success", cartUnitCount: 0 })),
  clearCartAction: vi.fn(async () => ({ status: "success", cartUnitCount: 0 })),
  transitionOrderAction: vi.fn(async () => ({ status: "success" })),
  markNotificationReadAction: vi.fn(async () => ({ status: "success" })),
  markAllNotificationsReadAction: vi.fn(async () => ({ status: "success" })),
  deleteNotificationAction: vi.fn(async () => ({ status: "success" })),
  deleteReadNotificationsAction: vi.fn(async () => ({ status: "success" })),
  deleteOrderAction: vi.fn(async () => ({ status: "success" })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({})),
    })),
    removeChannel: vi.fn(async () => ({})),
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  redirect: vi.fn(),
}));

import {
  clearCartAction,
  deleteNotificationAction,
  deleteOrderAction,
  deleteReadNotificationsAction,
  markNotificationReadAction,
  removeCartItemAction,
  updateCartItemQuantityAction,
} from "@/lib/orders/actions";
import type { CartItem } from "@/lib/orders/types";

import { CartLines } from "./cart-lines";
import { DeleteOrderButton } from "./order-actions";
import { NotificationBell } from "./notification-bell";
import { OrderStatusBadge, OrderTimeline } from "./order-display";
import { OrderTransitionButtons } from "./order-transition-buttons";

const money = { currency: "INR", currencySymbol: "₹" };

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "line-1",
    productId: "p1",
    productName: "Chocolate Cake",
    productSlug: "chocolate-cake",
    variantId: "v1",
    variantLabel: "2 Pound",
    flavourId: null,
    flavourName: null,
    quantity: 1,
    eggEggless: null,
    message: null,
    designPath: null,
    pickupAt: null,
    unitPricePaise: 110000,
    lineTotalPaise: 110000,
    imagePath: null,
    valid: true,
    invalidReason: null,
    ...overrides,
  };
}

describe("OrderStatusBadge / OrderTimeline", () => {
  it("labels statuses and marks the timeline", () => {
    render(<OrderStatusBadge status="baking" />);
    expect(screen.getByText("Baking")).toBeInTheDocument();

    const { rerender } = render(<OrderTimeline status="ready_for_pickup" />);
    expect(screen.getByText("Ready for pickup")).toBeInTheDocument();

    rerender(<OrderTimeline status="cancelled" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});

describe("CartLines", () => {
  it("renders lines with server totals and mutates through actions", async () => {
    const user = userEvent.setup();
    render(
      <CartLines
        items={[
          line(),
          line({
            id: "line-2",
            productName: "Brownie",
            variantLabel: null,
            unitPricePaise: 8000,
            lineTotalPaise: 16000,
            quantity: 2,
          }),
        ]}
        webstore="/webstore/u1"
        money={money}
      />,
    );

    expect(screen.getByText("Chocolate Cake")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,100.00")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: /increase quantity/i })[0]);
    expect(updateCartItemQuantityAction).toHaveBeenCalledWith("line-1", 2);

    await user.click(screen.getAllByRole("button", { name: /^remove$/i })[1]);
    expect(removeCartItemAction).toHaveBeenCalledWith("line-2");

    await user.click(screen.getByRole("button", { name: /clear cart/i }));
    expect(clearCartAction).toHaveBeenCalled();
  });

  it("flags invalid lines", () => {
    render(
      <CartLines
        items={[line({ valid: false, invalidReason: "No longer available." })]}
        webstore="/webstore/u1"
        money={money}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/no longer available/i);
  });
});

describe("NotificationBell", () => {
  const items = [
    {
      id: "n1",
      type: "ORDER_PLACED",
      title: "Order placed",
      message: "Order #BNK-1 placed.",
      entityType: "order",
      entityId: "o1",
      isRead: false,
      createdAt: null,
    },
  ];

  it("shows the unread badge and opens the panel", async () => {
    const user = userEvent.setup();
    render(
      <NotificationBell
        userId="u1"
        initialUnread={2}
        initialItems={items}
        orderBasePath="/owner/orders"
      />,
    );

    expect(screen.getByRole("button", { name: /2 unread/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText("Order #BNK-1 placed.")).toBeInTheDocument();
  });

  it("routes to the exact order when a notification is clicked", async () => {
    const { useRouter } = await import("next/navigation");
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh: vi.fn(), push } as never);
    const user = userEvent.setup();
    render(
      <NotificationBell
        userId="u1"
        initialUnread={1}
        initialItems={items}
        orderBasePath="/owner/orders"
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications/i }));
    await user.click(
      screen.getByRole("button", { name: /^unreadorder placedorder #bnk-1 placed\.$/i }),
    );
    expect(markNotificationReadAction).toHaveBeenCalledWith("n1");
    expect(push).toHaveBeenCalledWith("/owner/orders/o1");
  });

  it("deletes one notification and all read notifications", async () => {
    const user = userEvent.setup();
    render(
      <NotificationBell
        userId="u1"
        initialUnread={1}
        initialItems={[
          ...items,
          {
            id: "n2",
            type: "NEW_ORDER",
            title: "Old update",
            message: "Already seen.",
            entityType: null,
            entityId: null,
            isRead: true,
            createdAt: null,
          },
        ]}
        orderBasePath="/owner/orders"
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications/i }));
    await user.click(screen.getByRole("button", { name: /delete notification: order placed/i }));
    expect(deleteNotificationAction).toHaveBeenCalledWith("n1");

    await user.click(screen.getByRole("button", { name: /delete read/i }));
    expect(deleteReadNotificationsAction).toHaveBeenCalled();
  });
});

describe("OrderTransitionButtons", () => {
  it("offers only the legal next steps", () => {
    render(<OrderTransitionButtons orderId="o1" status="pending" />);

    expect(screen.getByRole("button", { name: /confirm order/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel order/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start baking/i })).not.toBeInTheDocument();
  });

  it("goes quiet on terminal orders", () => {
    render(<OrderTransitionButtons orderId="o1" status="completed" />);

    expect(screen.getByText(/no further changes/i)).toBeInTheDocument();
  });

  it("requires the paid confirmation before completing", () => {
    render(<OrderTransitionButtons orderId="o1" status="ready_for_pickup" />);

    const paid = screen.getByRole("checkbox", { name: /payment received/i });
    expect(paid).toBeInTheDocument();
    expect(paid).toBeRequired();
    expect(screen.getByRole("button", { name: /complete order/i })).toBeInTheDocument();
  });
});

describe("DeleteOrderButton", () => {
  it("asks twice and deletes on confirm", async () => {
    const user = userEvent.setup();
    render(<DeleteOrderButton orderId="o1" returnTo="/owner/orders" />);

    await user.click(screen.getByRole("button", { name: /delete this order/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(deleteOrderAction).toHaveBeenCalledWith(
      "o1",
      "/owner/orders",
      expect.anything(),
      expect.anything(),
    );
  });
});
