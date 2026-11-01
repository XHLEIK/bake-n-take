import { describe, expect, it } from "vitest";

import {
  allowedTransitions,
  canTransition,
  isOrderStatus,
  ORDER_STATUS_DESCRIPTIONS,
  ORDER_STATUS_LABELS,
} from "./machine";

describe("order state machine", () => {
  it("recognizes the six statuses", () => {
    for (const status of [
      "pending",
      "confirmed",
      "baking",
      "ready_for_pickup",
      "completed",
      "cancelled",
    ]) {
      expect(isOrderStatus(status)).toBe(true);
    }
    expect(isOrderStatus("shipped")).toBe(false);
    expect(isOrderStatus(null)).toBe(false);
  });

  it("walks the happy path forward only", () => {
    expect(allowedTransitions("pending")).toEqual(["confirmed", "cancelled"]);
    expect(allowedTransitions("confirmed")).toEqual(["baking", "cancelled"]);
    expect(allowedTransitions("baking")).toEqual(["ready_for_pickup", "cancelled"]);
    expect(allowedTransitions("ready_for_pickup")).toEqual(["completed", "cancelled"]);
    expect(allowedTransitions("completed")).toEqual([]);
    expect(allowedTransitions("cancelled")).toEqual([]);
  });

  it("lets owners advance and cancel anything unfinished", () => {
    expect(canTransition("pending", "confirmed", "OWNER")).toBe(true);
    expect(canTransition("baking", "ready_for_pickup", "OWNER")).toBe(true);
    expect(canTransition("ready_for_pickup", "completed", "OWNER")).toBe(true);
    expect(canTransition("confirmed", "cancelled", "OWNER")).toBe(true);
    expect(canTransition("completed", "cancelled", "OWNER")).toBe(false);
  });

  it("lets customers cancel only their own pending order", () => {
    expect(canTransition("pending", "cancelled", "CUSTOMER")).toBe(true);
    expect(canTransition("pending", "confirmed", "CUSTOMER")).toBe(false);
    expect(canTransition("confirmed", "cancelled", "CUSTOMER")).toBe(false);
    expect(canTransition("baking", "cancelled", "CUSTOMER")).toBe(false);
  });

  it("rejects jumps and backward moves for everyone", () => {
    expect(canTransition("pending", "completed", "OWNER")).toBe(false);
    expect(canTransition("pending", "baking", "OWNER")).toBe(false);
    expect(canTransition("completed", "pending", "OWNER")).toBe(false);
    expect(canTransition("cancelled", "pending", "OWNER")).toBe(false);
  });

  it("labels every status for humans", () => {
    for (const status of [
      "pending",
      "confirmed",
      "baking",
      "ready_for_pickup",
      "completed",
      "cancelled",
    ] as const) {
      expect(ORDER_STATUS_LABELS[status].length).toBeGreaterThan(0);
      expect(ORDER_STATUS_DESCRIPTIONS[status].length).toBeGreaterThan(0);
    }
  });
});
