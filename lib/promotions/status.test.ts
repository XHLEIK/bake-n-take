import { describe, expect, it } from "vitest";

import { canTransitionStatus, effectiveStatus } from "./status";

const START = "2026-11-01T04:30:00.000Z";
const END = "2026-12-01T04:30:00.000Z";

describe("effectiveStatus", () => {
  it("passes stored terminal states straight through", () => {
    const now = new Date("2026-11-15T00:00:00.000Z");
    expect(effectiveStatus("draft", null, null, now)).toBe("draft");
    expect(effectiveStatus("paused", START, END, now)).toBe("paused");
    expect(effectiveStatus("archived", START, END, now)).toBe("archived");
  });

  it("derives scheduled and expired from the window", () => {
    expect(effectiveStatus("active", START, END, new Date("2026-10-01T00:00:00.000Z"))).toBe(
      "scheduled",
    );
    expect(effectiveStatus("active", START, END, new Date("2026-11-15T00:00:00.000Z"))).toBe(
      "active",
    );
    expect(effectiveStatus("active", START, END, new Date("2027-01-01T00:00:00.000Z"))).toBe(
      "expired",
    );
  });

  it("treats the end boundary as exclusive", () => {
    expect(effectiveStatus("active", null, END, new Date(END))).toBe("expired");
  });

  it("stays active without a window", () => {
    expect(effectiveStatus("active", null, null, new Date())).toBe("active");
  });
});

describe("canTransitionStatus", () => {
  it("allows the documented lifecycle and nothing else", () => {
    expect(canTransitionStatus("draft", "active")).toBe(true);
    expect(canTransitionStatus("draft", "paused")).toBe(false);
    expect(canTransitionStatus("active", "paused")).toBe(true);
    expect(canTransitionStatus("paused", "active")).toBe(true);
    expect(canTransitionStatus("active", "archived")).toBe(true);
    expect(canTransitionStatus("paused", "archived")).toBe(true);
    expect(canTransitionStatus("archived", "active")).toBe(false);
    expect(canTransitionStatus("archived", "archived")).toBe(true);
  });
});
