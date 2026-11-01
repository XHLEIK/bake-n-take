import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";
import {
  dayKeyFor,
  hasAnyHours,
  mapSettingsRow,
  resolveAbout,
  resolveAboutCtaHref,
  type WeekHours,
} from "./types";
import { DEFAULT_ABOUT, WEEK_DAYS } from "./types";

function closedWeek(): WeekHours {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [day, { open: false, opens_at: "09:00", closes_at: "21:00" }]),
  ) as WeekHours;
}

describe("mapSettingsRow", () => {
  it("maps a complete row", () => {
    const settings = mapSettingsRow({
      store_name: "Bake n Take",
      tagline: "Fresh",
      description: "Bakery",
      logo_path: "logos/a.png",
      phone_primary: "+91 1",
      country: "India",
      latitude: 19.07,
      longitude: 72.87,
      socials: { instagram: "https://instagram.com/x" },
      hours: { monday: { open: true, opens_at: "09:00", closes_at: "21:00" } },
      is_open: true,
      accepting_orders: false,
      status_message: "Paused",
      currency: "INR",
      currency_symbol: "₹",
      timezone: "Asia/Kolkata",
      updated_at: "2026-09-25T00:00:00Z",
    });

    expect(settings?.storeName).toBe("Bake n Take");
    expect(settings?.logoPath).toBe("logos/a.png");
    expect(settings?.acceptingOrders).toBe(false);
    expect(settings?.socials.instagram).toBe("https://instagram.com/x");
    expect(settings?.hours.monday).toEqual({ open: true, opens_at: "09:00", closes_at: "21:00" });
    // Malformed or missing days degrade to closed defaults, never throw.
    expect(settings?.hours.tuesday).toEqual({ open: false, opens_at: "09:00", closes_at: "21:00" });
  });

  it("rejects rows without a store name and non-objects", () => {
    expect(mapSettingsRow({ store_name: "  " })).toBeNull();
    expect(mapSettingsRow({})).toBeNull();
    expect(mapSettingsRow(null)).toBeNull();
    expect(mapSettingsRow(undefined)).toBeNull();
  });

  it("fails closed on bad enums, ranges and unknown social shapes", () => {
    const settings = mapSettingsRow({
      store_name: "Bake n Take",
      currency: "rupees",
      latitude: 200,
      longitude: -300,
      socials: { instagram: 42, extra: "nope" },
      hours: "nope",
    });

    expect(settings?.currency).toBe("INR");
    expect(settings?.latitude).toBeNull();
    expect(settings?.longitude).toBeNull();
    expect(settings?.socials).toEqual({});
    expect(settings?.hours).toEqual(closedWeek());
  });
});

describe("day helpers", () => {
  it("maps getDay() to weekday keys", () => {
    // 2026-09-28 is a Monday.
    expect(dayKeyFor(new Date(2026, 8, 28))).toBe("monday");
    expect(dayKeyFor(new Date(2026, 8, 27))).toBe("sunday");
  });

  it("detects weeks with no open days", () => {
    expect(hasAnyHours(closedWeek())).toBe(false);
    expect(
      hasAnyHours({
        ...closedWeek(),
        friday: { open: true, opens_at: "09:00", closes_at: "21:00" },
      }),
    ).toBe(true);
  });
});

describe("formatMoney", () => {
  it("formats in the store currency", () => {
    const settings = { currency: "INR", currencySymbol: "₹" };
    expect(formatMoney(249.5, settings)).toContain("249.50");
    expect(formatMoney(249.5, settings)).toContain("₹");
  });

  it("never throws on bad input", () => {
    expect(formatMoney(Number.NaN, { currency: "INR", currencySymbol: "₹" })).toBe("₹0");
  });
});

describe("resolveAbout", () => {
  it("returns compiled defaults for missing or malformed input", () => {
    expect(resolveAbout(null)).toEqual(DEFAULT_ABOUT);
    expect(resolveAbout(undefined)).toEqual(DEFAULT_ABOUT);
    expect(resolveAbout("nope")).toEqual(DEFAULT_ABOUT);
    expect(resolveAbout({})).toEqual(DEFAULT_ABOUT);
  });

  it("merges stored fields over defaults and tolerates junk", () => {
    expect(
      resolveAbout({
        enabled: false,
        heading: "Our story",
        secondary: "",
        cta_href: "javascript:alert(1)",
        banner: "nope",
        bannerPath: "../evil.png",
      }),
    ).toEqual({
      ...DEFAULT_ABOUT,
      enabled: false,
      heading: "Our story",
      secondary: "",
      bannerPath: null,
    });
  });

  it("keeps a well-formed custom banner path", () => {
    expect(resolveAbout({ banner_path: "banners/about/abc.png" }).bannerPath).toBe(
      "banners/about/abc.png",
    );
  });

  it("resolves internal CTA paths against the webstore", () => {
    expect(resolveAboutCtaHref("/webstore/u1", "/shop")).toBe("/webstore/u1/shop");
    expect(resolveAboutCtaHref("/webstore/u1", "https://example.com/x")).toBe(
      "https://example.com/x",
    );
    expect(resolveAboutCtaHref("/webstore/u1", "nope")).toBe("/webstore/u1/shop");
  });
});
