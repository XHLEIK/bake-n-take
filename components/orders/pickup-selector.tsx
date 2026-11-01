"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CircleCheck } from "lucide-react";

import {
  formatEarliestPickup,
  formatPrepDuration,
  isoToPickupParts,
  pickupDayOptions,
  pickupTimeSlots,
  pickupToIso,
} from "@/lib/orders/pickup";
import type { WeekHours } from "@/lib/store/types";

/**
 * Pickup date + time selector (customer product page).
 *
 * Date and time stay separate native selects: keyboard and screen-reader
 * friendly with zero dependencies. Slots earlier than the live minimum
 * render disabled (never silently dropped), and the whole block degrades
 * to an honest notice when the bakery has no usable slots at all. The
 * parent owns the chosen ISO instant; the server re-validates everything
 * at cart and order time.
 */
export function PickupSelector({
  minPrepMinutes,
  hours,
  nowMs,
  value,
  onChange,
}: {
  minPrepMinutes: number;
  hours: WeekHours | null;
  /** Render-time clock; the parent re-checks freshness at submit. */
  nowMs: number;
  /** Chosen pickup instant (UTC ISO), or null when nothing valid exists. */
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  const days = useMemo(
    () => pickupDayOptions(nowMs, minPrepMinutes, hours),
    [nowMs, minPrepMinutes, hours],
  );
  const [dateStr, setDateStr] = useState<string>(() => days[0]?.dateStr ?? "");
  const slots = useMemo(
    () => (dateStr ? pickupTimeSlots(dateStr, nowMs, minPrepMinutes, hours) : []),
    [dateStr, nowMs, minPrepMinutes, hours],
  );
  const firstOpen = slots.find((slot) => !slot.disabled) ?? null;
  const earliest = formatEarliestPickup(nowMs, minPrepMinutes);

  function pickDate(next: string) {
    setDateStr(next);
    const open = pickupTimeSlots(next, nowMs, minPrepMinutes, hours).find((slot) => !slot.disabled);
    onChange(open ? pickupToIso(next, open.timeStr) : null);
  }

  function pickTime(next: string) {
    onChange(next && dateStr ? pickupToIso(dateStr, next) : null);
  }

  // The stored value is a UTC instant; the slot list speaks IST wall time,
  // so compare in IST. A value picked for another date contributes nothing
  // to this date's select (the date select owns that switch instead).
  const valueParts = isoToPickupParts(value);
  const valueTimeForDate = valueParts && valueParts.dateStr === dateStr ? valueParts.timeStr : "";
  const selectedTime = value ? valueTimeForDate : (firstOpen?.timeStr ?? "");
  const selectedStale =
    selectedTime !== "" && !slots.some((slot) => slot.timeStr === selectedTime && !slot.disabled);

  return (
    <fieldset className="grid gap-3">
      <legend className="flex items-center gap-2 pb-1 text-sm font-medium">
        <CalendarClock aria-hidden="true" className="size-4 text-primary" />
        Pickup date &amp; time
      </legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Made fresh for you — this bake needs at least{" "}
        <strong className="font-medium text-foreground">
          {formatPrepDuration(minPrepMinutes)}
        </strong>{" "}
        of preparation.
      </p>
      {days.length === 0 ? (
        <p
          role="status"
          className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground"
        >
          No pickup slots are available right now — please check back soon.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="pickup-date" className="text-xs font-medium text-muted-foreground">
              Date
            </label>
            <select
              id="pickup-date"
              value={dateStr}
              onChange={(event) => pickDate(event.currentTarget.value)}
              className="h-11 w-full rounded-xl border border-input bg-card/70 px-3 text-sm shadow-xs"
            >
              {days.map((day) => (
                <option key={day.dateStr} value={day.dateStr}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="pickup-time" className="text-xs font-medium text-muted-foreground">
              Time
            </label>
            <select
              id="pickup-time"
              value={selectedStale ? "" : selectedTime}
              onChange={(event) => pickTime(event.currentTarget.value)}
              className="h-11 w-full rounded-xl border border-input bg-card/70 px-3 text-sm shadow-xs"
            >
              {selectedStale ? <option value="">Pick a later time…</option> : null}
              {slots.map((slot) => (
                <option key={slot.timeStr} value={slot.timeStr} disabled={slot.disabled}>
                  {slot.label}
                  {slot.disabled ? " (too soon)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {earliest ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-3.5 text-primary" />
          Earliest pickup: {earliest}
        </p>
      ) : null}
    </fieldset>
  );
}
