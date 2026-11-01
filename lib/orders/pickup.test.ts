import { describe, expect, it } from "vitest";

import { WEEK_DAYS, type WeekDay, type WeekHours } from "@/lib/store/types";

import {
  earliestPickupAt,
  formatEarliestPickup,
  formatPickupAt,
  formatPrepDuration,
  isPickupValid,
  isoToPickupParts,
  isSlotWithinHours,
  isWithinStoreHours,
  pickupDayOptions,
  pickupTimeSlots,
  pickupToIso,
  PICKUP_WINDOW_DAYS,
} from "./pickup";

/** 2026-09-26 10:30 IST — the spec's example morning. */
const MORNING = Date.UTC(2026, 8, 26, 5, 0, 0);
/** 2026-09-26 22:30 IST — twelve hours later. */
const EVENING = Date.UTC(2026, 8, 26, 17, 0, 0);

function closedHours(): WeekHours {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [day, { open: false, opens_at: "09:00", closes_at: "21:00" }]),
  ) as WeekHours;
}

function openDaily(from = "09:00", to = "21:00"): WeekHours {
  const hours = closedHours();
  for (const day of WEEK_DAYS as readonly WeekDay[]) {
    hours[day] = { open: true, opens_at: from, closes_at: to };
  }
  return hours;
}

describe("earliestPickupAt / isPickupValid", () => {
  it("adds the minimum lead time to the exact minute", () => {
    expect(earliestPickupAt(MORNING, 720)).toBe(EVENING);
    expect(earliestPickupAt(MORNING, 0)).toBe(MORNING);
  });

  it("crosses midnight and multiple days by absolute time", () => {
    expect(earliestPickupAt(MORNING, 1440)).toBe(MORNING + 24 * 60 * 60 * 1000);
    expect(earliestPickupAt(MORNING, 2880)).toBe(MORNING + 48 * 60 * 60 * 1000);
  });

  it("treats exactly-minimum as valid and anything earlier as invalid", () => {
    expect(isPickupValid(EVENING, MORNING, 720)).toBe(true);
    expect(isPickupValid(EVENING - 60 * 1000, MORNING, 720)).toBe(false);
    expect(isPickupValid(Number.NaN, MORNING, 720)).toBe(false);
  });
});

describe("pickupToIso / formatPickupAt", () => {
  it("round-trips IST wall time through UTC", () => {
    expect(pickupToIso("2026-09-26", "22:30")).toBe("2026-09-26T17:00:00.000Z");
    expect(pickupToIso("2026-09-26", "25:00")).toBeNull();
    expect(pickupToIso("nope", "22:30")).toBeNull();
  });

  it("formats for reassurance copy in IST", () => {
    expect(formatPickupAt("2026-09-26T17:00:00.000Z")).toBe("Saturday 26 September · 10:30 PM");
    expect(formatPickupAt(null)).toBeNull();
    expect(formatPickupAt("garbage")).toBeNull();
    expect(formatEarliestPickup(MORNING, 720)).toBe("Saturday 26 September · 10:30 PM");
  });

  it("names preparation durations plainly", () => {
    expect(formatPrepDuration(0)).toBe("Ready now");
    expect(formatPrepDuration(60)).toBe("1 hour");
    expect(formatPrepDuration(120)).toBe("2 hours");
    expect(formatPrepDuration(90)).toBe("1 hour 30 min");
    expect(formatPrepDuration(1500)).toBe("1 day 1 hour");
    expect(formatPrepDuration(2880)).toBe("2 days");
  });
});

describe("store hours", () => {
  it("accepts slot starts that fit and rejects the rest", () => {
    const day = { open: true, opens_at: "09:00", closes_at: "21:00" };
    expect(isSlotWithinHours(9 * 60, day)).toBe(true);
    expect(isSlotWithinHours(20 * 60 + 30, day)).toBe(true);
    expect(isSlotWithinHours(8 * 60 + 30, day)).toBe(false);
    expect(isSlotWithinHours(21 * 60, day)).toBe(false);
    expect(isSlotWithinHours(9 * 60, { ...day, open: false })).toBe(false);
    expect(isSlotWithinHours(9 * 60, { open: true, opens_at: "xx", closes_at: "21:00" })).toBe(
      false,
    );
  });

  it("treats missing hours as unconstrained", () => {
    expect(isWithinStoreHours(MORNING, closedHours())).toBe(true);
    expect(isWithinStoreHours(MORNING, openDaily())).toBe(true);
  });

  it("rejects instants outside the open window", () => {
    const hours = openDaily("10:00", "20:00");
    // 2026-09-26 09:30 IST — before opening.
    expect(isWithinStoreHours(Date.UTC(2026, 8, 26, 4, 0), hours)).toBe(false);
    // 2026-09-26 10:30 IST — inside.
    expect(isWithinStoreHours(Date.UTC(2026, 8, 26, 5, 0), hours)).toBe(true);
  });
});

describe("pickupDayOptions / pickupTimeSlots", () => {
  it("labels today and tomorrow and spans the window", () => {
    const days = pickupDayOptions(MORNING, 0, openDaily());
    expect(days).toHaveLength(PICKUP_WINDOW_DAYS);
    expect(days[0]?.label).toMatch(/^Today · /);
    expect(days[1]?.label).toMatch(/^Tomorrow · /);
  });

  it("skips closed days", () => {
    const hours = closedHours();
    hours.saturday = { open: true, opens_at: "09:00", closes_at: "21:00" };
    const days = pickupDayOptions(MORNING, 0, hours);
    expect(days.length).toBeGreaterThan(0);
    // 2026-09-26 is a Saturday; next Saturday is 7 days out.
    expect(days[0]?.dateStr).toBe("2026-09-26");
    expect(days[1]?.dateStr).toBe("2026-10-03");
  });

  it("disables past and too-soon slots without hiding them", () => {
    const slots = pickupTimeSlots("2026-09-26", MORNING, 720, openDaily());
    expect(slots.length).toBeGreaterThan(0);
    const open = slots.filter((slot) => !slot.disabled);
    // Earliest is 22:30 IST, but the day closes at 21:00 — nothing usable.
    expect(open).toHaveLength(0);
  });

  it("keeps later slots selectable on the same day", () => {
    const slots = pickupTimeSlots("2026-09-26", MORNING, 120, openDaily());
    const labels = slots.filter((slot) => !slot.disabled).map((slot) => slot.label);
    expect(slots.find((slot) => slot.timeStr === "12:00")?.disabled).toBe(true);
    expect(slots.find((slot) => slot.timeStr === "12:30")?.disabled).toBe(false);
    expect(labels[0]).toMatch(/12:30 PM/);
  });

  it("rejects malformed dates", () => {
    expect(pickupTimeSlots("tomorrow", MORNING, 0, openDaily())).toEqual([]);
  });

  it("round-trips an ISO instant back to its IST slot parts", () => {
    // 14:00 IST is 08:30 UTC — a UTC slice would read "08:30" and miss.
    expect(isoToPickupParts(pickupToIso("2026-09-26", "14:00"))).toEqual({
      dateStr: "2026-09-26",
      timeStr: "14:00",
    });
    expect(isoToPickupParts(null)).toBeNull();
    expect(isoToPickupParts("not-a-date")).toBeNull();
  });
});
