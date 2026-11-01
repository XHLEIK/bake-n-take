import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WeekHours } from "@/lib/store/types";

import { PickupSelector } from "./pickup-selector";

/** 2026-09-26 10:30 IST. */
const NOW = Date.UTC(2026, 8, 26, 5, 0, 0);

function openDaily(): WeekHours {
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;
  return Object.fromEntries(
    days.map((day) => [day, { open: true, opens_at: "09:00", closes_at: "21:00" }]),
  ) as WeekHours;
}

describe("PickupSelector", () => {
  it("announces the requirement and the earliest pickup", () => {
    render(
      <PickupSelector
        minPrepMinutes={720}
        hours={openDaily()}
        nowMs={NOW}
        value={null}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText(/needs at least/)).toBeInTheDocument();
    expect(screen.getByText(/Earliest pickup:/)).toBeInTheDocument();
  });

  it("disables too-soon times but keeps them visible", () => {
    render(
      <PickupSelector
        minPrepMinutes={120}
        hours={openDaily()}
        nowMs={NOW}
        value={null}
        onChange={() => undefined}
      />,
    );
    // Earliest is 12:30 IST on the default (today) date.
    const time = screen.getByLabelText("Time") as HTMLSelectElement;
    const tooSoon = [...time.options].find((option) => option.value === "12:00");
    const fine = [...time.options].find((option) => option.value === "12:30");
    expect(tooSoon?.disabled).toBe(true);
    expect(fine?.disabled).toBe(false);
    expect(tooSoon).toHaveTextContent(/too soon/);
  });

  it("emits an ISO instant when the customer picks a slot", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PickupSelector
        minPrepMinutes={120}
        hours={openDaily()}
        nowMs={NOW}
        value={null}
        onChange={onChange}
      />,
    );
    // Earliest is 12:30 IST: pick the 14:00 slot on the default (today) date.
    await user.selectOptions(screen.getByLabelText("Time"), "14:00");
    expect(onChange).toHaveBeenCalledWith("2026-09-26T08:30:00.000Z");
  });

  it("says so honestly when no day has a usable slot", () => {
    // A 30-day minimum pushes every slot in the 14-day window out of reach.
    render(
      <PickupSelector
        minPrepMinutes={43200}
        hours={openDaily()}
        nowMs={NOW}
        value={null}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();
  });

  it("shows the chosen slot instead of forgetting it", () => {
    // 14:00 IST stores as 08:30 UTC — the select must still read 14:00.
    render(
      <PickupSelector
        minPrepMinutes={120}
        hours={openDaily()}
        nowMs={NOW}
        value="2026-09-26T08:30:00.000Z"
        onChange={() => undefined}
      />,
    );
    const time = screen.getByLabelText("Time") as HTMLSelectElement;
    expect(time.value).toBe("14:00");
    expect(screen.queryByText(/pick a later time/i)).not.toBeInTheDocument();
  });
});
