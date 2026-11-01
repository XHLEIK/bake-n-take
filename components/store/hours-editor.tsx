"use client";

import { cn } from "cn";

import { WEEK_DAYS, type WeekDay, type WeekHours } from "@/lib/store/types";

/**
 * Seven independent day rows. Emits whole WeekHours objects; the parent
 * serializes them into a hidden input for the server action.
 */
export function HoursEditor({
  value,
  onChange,
  error,
}: {
  value: WeekHours;
  onChange: (value: WeekHours) => void;
  error?: string;
}) {
  function setDay(day: WeekDay, patch: Partial<WeekHours[WeekDay]>) {
    onChange({ ...value, [day]: { ...value[day], ...patch } });
  }

  return (
    <div className="grid gap-2">
      <ul className="divide-y divide-border/70 rounded-xl border border-border/70">
        {WEEK_DAYS.map((day) => {
          const row = value[day];
          return (
            <li
              key={day}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3.5 py-2.5 sm:grid-cols-[7rem_1fr_auto]",
                !row.open && "opacity-70",
              )}
            >
              <span className="text-sm font-medium capitalize">{day}</span>

              <div className="hidden items-center gap-2 sm:flex">
                <label className="sr-only" htmlFor={`hours-${day}-opens`}>
                  {day} opens at
                </label>
                <input
                  id={`hours-${day}-opens`}
                  type="time"
                  value={row.opens_at}
                  disabled={!row.open}
                  onChange={(event) => setDay(day, { opens_at: event.currentTarget.value })}
                  className="h-10 rounded-lg border border-input bg-card px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                />
                <span aria-hidden="true" className="text-xs text-muted-foreground">
                  to
                </span>
                <label className="sr-only" htmlFor={`hours-${day}-closes`}>
                  {day} closes at
                </label>
                <input
                  id={`hours-${day}-closes`}
                  type="time"
                  value={row.closes_at}
                  disabled={!row.open}
                  onChange={(event) => setDay(day, { closes_at: event.currentTarget.value })}
                  className="h-10 rounded-lg border border-input bg-card px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                />
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={row.open}
                aria-label={`${day} ${row.open ? "open" : "closed"}`}
                onClick={() => setDay(day, { open: !row.open })}
                className={cn(
                  "relative h-7 w-12 justify-self-end rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  row.open ? "bg-primary" : "bg-input",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1 left-1 size-5 rounded-full bg-card shadow transition-transform",
                    row.open ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>

              <div className="col-span-2 flex items-center gap-2 sm:hidden">
                <input
                  type="time"
                  aria-label={`${day} opens at`}
                  value={row.opens_at}
                  disabled={!row.open}
                  onChange={(event) => setDay(day, { opens_at: event.currentTarget.value })}
                  className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                />
                <span aria-hidden="true" className="text-xs text-muted-foreground">
                  to
                </span>
                <input
                  type="time"
                  aria-label={`${day} closes at`}
                  value={row.closes_at}
                  disabled={!row.open}
                  onChange={(event) => setDay(day, { closes_at: event.currentTarget.value })}
                  className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                />
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
