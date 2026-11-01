import { hasAnyHours, type WeekDay, type WeekHours } from "@/lib/store/types";
import { istLocalToIso } from "@/lib/promotions/validation";

/**
 * Pickup scheduling math (Phase 8).
 *
 * The bakery works in Asia/Kolkata wall time (fixed +05:30, no DST), so all
 * calendar arithmetic here is done on IST wall clocks derived per instant —
 * never on the browser's local timezone. Every function is pure and takes
 * an explicit `nowMs`, which makes stale pages, midnight crossings and unit
 * tests deterministic. The server re-validates the same inequality at order
 * creation; the UI additionally constrains slots to store open hours.
 */

export const PICKUP_SLOT_MINUTES = 30;
export const PICKUP_WINDOW_DAYS = 14;
/** Mirrors the products.min_prep_minutes check constraint. */
export const MAX_PREP_MINUTES = 43200;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function clampPrep(minPrepMinutes: number): number {
  if (!Number.isFinite(minPrepMinutes)) return 0;
  return Math.min(MAX_PREP_MINUTES, Math.max(0, Math.floor(minPrepMinutes)));
}

/** Earliest collectable instant: order time plus prep, exact to the minute. */
export function earliestPickupAt(orderNowMs: number, minPrepMinutes: number): number {
  return orderNowMs + clampPrep(minPrepMinutes) * 60 * 1000;
}

/** Boundary-inclusive: exactly minimum-early is a valid pickup. */
export function isPickupValid(
  pickupMs: number,
  orderNowMs: number,
  minPrepMinutes: number,
): boolean {
  if (!Number.isFinite(pickupMs)) return false;
  return pickupMs >= earliestPickupAt(orderNowMs, minPrepMinutes);
}

type IstParts = {
  year: string;
  month: string;
  day: string;
  weekday: WeekDay;
  hour: number;
  minute: number;
};

const WEEKDAY_TO_KEY: Record<string, WeekDay> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};

function istParts(ms: number): IstParts | null {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = WEEKDAY_TO_KEY[get("weekday")];
  if (!weekday) return null;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    weekday,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** IST calendar date (YYYY-MM-DD) plus midnight instant for a day offset. */
function istDayAt(
  dayOffset: number,
  nowMs: number,
): { dateStr: string; midnightMs: number } | null {
  const base = istParts(nowMs);
  if (!base) return null;
  const midnightMs =
    Date.UTC(Number(base.year), Number(base.month) - 1, Number(base.day)) -
    IST_OFFSET_MS +
    dayOffset * DAY_MS;
  const day = istParts(midnightMs + 60 * 1000);
  if (!day) return null;
  return { dateStr: `${day.year}-${day.month}-${day.day}`, midnightMs };
}

function minutesOf(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Whether a 30-minute slot starting at `startMinutes` fits inside the day's
 * open window. Days without a usable window (closed, malformed, or overnight
 * ranges the store model cannot express) accept no slots — fail closed.
 */
export function isSlotWithinHours(
  startMinutes: number,
  day: { open: boolean; opens_at: string; closes_at: string },
): boolean {
  if (!day.open) return false;
  const opens = minutesOf(day.opens_at);
  const closes = minutesOf(day.closes_at);
  if (opens === null || closes === null || closes <= opens) return false;
  return startMinutes >= opens && startMinutes + PICKUP_SLOT_MINUTES <= closes;
}

/** True when an exact pickup instant falls inside that day's open window. */
export function isWithinStoreHours(pickupMs: number, hours: WeekHours | null): boolean {
  if (!hours || !hasAnyHours(hours)) return true;
  const parts = istParts(pickupMs);
  if (!parts) return false;
  return isSlotWithinHours(parts.hour * 60 + parts.minute, hours[parts.weekday]);
}

export type PickupDayOption = {
  /** IST calendar date, the `<select>` value. */
  dateStr: string;
  label: string;
};

/**
 * Pickable dates: today through the window, skipping days with no usable
 * slot (closed days, or today when the minimum already pushes past close).
 * Days without any configured hours anywhere behave as fully open.
 */
export function pickupDayOptions(
  nowMs: number,
  minPrepMinutes: number,
  hours: WeekHours | null,
  maxDays: number = PICKUP_WINDOW_DAYS,
): PickupDayOption[] {
  const days: PickupDayOption[] = [];
  const todayStr = istDayAt(0, nowMs)?.dateStr;
  for (let offset = 0; offset < maxDays; offset += 1) {
    const day = istDayAt(offset, nowMs);
    if (!day) continue;
    const slots = pickupTimeSlots(day.dateStr, nowMs, minPrepMinutes, hours);
    if (!slots.some((slot) => !slot.disabled)) continue;
    const labelDate = new Date(`${day.dateStr}T12:00:00+05:30`);
    const pretty = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(labelDate);
    days.push({
      dateStr: day.dateStr,
      label:
        day.dateStr === todayStr
          ? `Today · ${pretty}`
          : offset === 1
            ? `Tomorrow · ${pretty}`
            : pretty,
    });
  }
  return days;
}

export type PickupTimeSlot = {
  /** "HH:MM" IST wall time, the `<select>` value. */
  timeStr: string;
  label: string;
  disabled: boolean;
};

/** 30-minute slots for one IST date; past/too-early slots disable, never hide. */
export function pickupTimeSlots(
  dateStr: string,
  nowMs: number,
  minPrepMinutes: number,
  hours: WeekHours | null,
): PickupTimeSlot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const earliest = earliestPickupAt(nowMs, minPrepMinutes);
  const noon = Date.parse(`${dateStr}T12:00:00+05:30`);
  if (Number.isNaN(noon)) return [];
  const midnightMs = noon - 12 * 60 * 60 * 1000;
  const slots: PickupTimeSlot[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += PICKUP_SLOT_MINUTES) {
    const at = midnightMs + minutes * 60 * 1000;
    const parts = istParts(at);
    if (!parts || `${parts.year}-${parts.month}-${parts.day}` !== dateStr) continue;
    if (!isWithinStoreHours(at, hours)) continue;
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(at));
    const timeStr = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
    slots.push({ timeStr, label, disabled: at < earliest });
  }
  return slots;
}

/** "Saturday, 27 September · 10:30 AM" in IST; null when unparseable. */
export function formatPickupAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(ms));
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
  return `${date} · ${time}`;
}

/** Combines a picked IST date + time into a UTC ISO instant. Null when bad. */
export function pickupToIso(dateStr: string, timeStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return null;
  return istLocalToIso(`${dateStr}T${timeStr}`);
}

/**
 * Splits a stored UTC instant back into the IST date + time the slot lists
 * use. The inverse of `pickupToIso` — the time select compares IST wall
 * times, never the UTC slice of the ISO string (which is +05:30 off and
 * made the select forget every choice). Null when unparseable.
 */
export function isoToPickupParts(iso: string | null | undefined): {
  dateStr: string;
  timeStr: string;
} | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const parts = istParts(ms);
  if (!parts) return null;
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    timeStr: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}

/** Earliest pickup formatted for reassurance copy ("Today, 10:30 PM"). */
export function formatEarliestPickup(orderNowMs: number, minPrepMinutes: number): string | null {
  return formatPickupAt(new Date(earliestPickupAt(orderNowMs, minPrepMinutes)).toISOString());
}

/** "Ready now", "2 hours", "1 day 2 hours" — for requirement copy. */
export function formatPrepDuration(minPrepMinutes: number): string {
  const total = clampPrep(minPrepMinutes);
  if (total === 0) return "Ready now";
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(" ");
}
