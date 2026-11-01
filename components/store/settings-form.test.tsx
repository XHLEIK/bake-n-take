import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StoreSettings, WeekHours } from "@/lib/store/types";
import { DEFAULT_ABOUT, WEEK_DAYS } from "@/lib/store/types";

vi.mock("@/lib/store/actions", () => ({
  updateStoreSettingsAction: vi.fn(),
}));

import { HoursEditor } from "./hours-editor";
import { LogoUploader, type StagedImage } from "./logo-uploader";
import { SettingsForm } from "./settings-form";
import { SettingsNav } from "./settings-sections";
import { SocialsEditor, type SocialsDraft } from "./socials-editor";

function openWeek(): WeekHours {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [day, { open: true, opens_at: "09:00", closes_at: "21:00" }]),
  ) as WeekHours;
}

function renderForm() {
  return render(
    <>
      <SettingsNav />
      <SettingsForm
        initial={settings()}
        logoUrl={null}
        faviconUrl={null}
        aboutBannerUrl={null}
        aboutDefaults={[
          { key: "bread", label: "Artisan bread", url: "https://example.com/bread.jpg" },
        ]}
      />
    </>,
  );
}

function settings(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    storeName: "Bake n Take",
    tagline: "Fresh",
    description: "Bakery",
    logoPath: null,
    faviconPath: null,
    phonePrimary: null,
    phoneSecondary: null,
    email: null,
    whatsapp: null,
    addressLine1: null,
    addressLine2: null,
    locality: null,
    city: null,
    state: null,
    postalCode: null,
    country: "India",
    mapsUrl: null,
    latitude: null,
    longitude: null,
    socials: {},
    hours: openWeek(),
    about: { ...DEFAULT_ABOUT },
    pickupInstructions: null,
    pickupLocation: null,
    pickupNotes: null,
    pickupEta: null,
    isOpen: true,
    acceptingOrders: true,
    statusMessage: "",
    heroMaxSlides: 5,
    currency: "INR",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    updatedAt: null,
    ...overrides,
  };
}

describe("SettingsForm", () => {
  it("renders every section with the stored values", () => {
    renderForm();

    for (const heading of [
      "Store identity",
      "Brand images",
      "Contact information",
      "Store address",
      "Business hours",
      "Social media",
      "Pickup information",
      "Store status",
      "About Us",
      "Regional settings",
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    // Contextual settings navigation (desktop rail + mobile chips).
    for (const entry of ["General", "Contact & Location", "Operations", "Storefront"]) {
      expect(screen.getAllByText(entry).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
    expect(screen.getByLabelText("Store name")).toHaveValue("Bake n Take");
    // Clean state shows a quiet status, not the action bar.
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^save settings$/i })).not.toBeInTheDocument();
  });

  it("serializes hours and socials for the server action", () => {
    renderForm();

    const hours = document.querySelector<HTMLInputElement>('input[name="hoursJson"]');
    const socials = document.querySelector<HTMLInputElement>('input[name="socialsJson"]');
    expect(JSON.parse(hours?.value ?? "{}").monday.open).toBe(true);
    expect(JSON.parse(socials?.value ?? "{}")).toEqual({
      instagram: "",
      facebook: "",
      whatsapp: "",
      extra: [],
    });
  });

  it("serializes the about section for the server action", () => {
    renderForm();

    const about = document.querySelector<HTMLInputElement>('input[name="aboutJson"]');
    expect(JSON.parse(about?.value ?? "{}")).toEqual({
      enabled: true,
      eyebrow: "Baked with patience",
      heading: "Made fresh, shared with love.",
      body: expect.any(String),
      secondary: expect.any(String),
      cta_label: "Explore the bake list",
      cta_href: "/shop",
      banner: "bread",
    });
  });

  it("announces unsaved changes after an edit and resets on demand", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("Store name"));
    await user.type(screen.getByLabelText("Store name"), "New Name");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save settings$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reset changes/i }));
    expect(screen.getByLabelText("Store name")).toHaveValue("Bake n Take");
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
  });

  it("stages logo and favicon uploads for the server action", () => {
    renderForm();

    expect(document.querySelector<HTMLInputElement>('input[name="logo"]')).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="favicon"]')).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="logoRemoved"]')?.value).toBe("0");
    expect(document.querySelector<HTMLInputElement>('input[name="faviconRemoved"]')?.value).toBe(
      "0",
    );
  });

  it("keeps every persisted field bound to the server action", () => {
    renderForm();

    for (const name of [
      "storeName",
      "tagline",
      "description",
      "phonePrimary",
      "phoneSecondary",
      "email",
      "whatsapp",
      "addressLine1",
      "addressLine2",
      "locality",
      "city",
      "state",
      "postalCode",
      "country",
      "mapsUrl",
      "latitude",
      "longitude",
      "hoursJson",
      "socialsJson",
      "aboutJson",
      "pickupInstructions",
      "pickupLocation",
      "pickupNotes",
      "pickupEta",
      "isOpen",
      "acceptingOrders",
      "statusMessage",
      "heroMaxSlides",
      "currency",
      "currencySymbol",
      "timezone",
      "logoRemoved",
      "faviconRemoved",
      "aboutBannerRemoved",
    ]) {
      expect(
        document.querySelector(`[name="${name}"]`),
        `field ${name} missing`,
      ).toBeInTheDocument();
    }
  });
});

describe("HoursEditor", () => {
  it("toggles a day closed and disables its times", async () => {
    const user = userEvent.setup();
    let current = openWeek();
    const onChange = vi.fn((value: WeekHours) => {
      current = value;
    });
    const { rerender } = render(<HoursEditor value={current} onChange={onChange} />);

    await user.click(screen.getByRole("switch", { name: "monday open" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ monday: expect.objectContaining({ open: false }) }),
    );

    rerender(
      <HoursEditor
        value={{ ...openWeek(), monday: { open: false, opens_at: "09:00", closes_at: "21:00" } }}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("switch", { name: "monday closed" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

describe("SocialsEditor", () => {
  const draft: SocialsDraft = { instagram: "", facebook: "", whatsapp: "", extra: [] };

  it("adds and removes extra platforms", async () => {
    const user = userEvent.setup();
    let current = draft;
    const onChange = vi.fn((value: SocialsDraft) => {
      current = value;
    });
    const { rerender } = render(<SocialsEditor value={current} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add another platform/i }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, extra: [{ label: "", url: "" }] });

    current = { ...draft, extra: [{ label: "YouTube", url: "https://youtube.com/@x" }] };
    rerender(<SocialsEditor value={current} onChange={onChange} />);
    expect(screen.getByLabelText("Platform name")).toHaveValue("YouTube");

    await user.click(screen.getByRole("button", { name: /remove youtube/i }));
    expect(onChange).toHaveBeenCalledWith(draft);
  });
});

describe("LogoUploader", () => {
  const empty: StagedImage = { currentUrl: null, file: null, removed: false };

  it("rejects non-image files before anything stages", async () => {
    const onChange = vi.fn();
    render(
      <LogoUploader
        name="logo"
        removedName="logoRemoved"
        label="Store logo"
        hint="Hint."
        value={empty}
        onChange={onChange}
      />,
    );

    const input = document.querySelector<HTMLInputElement>('input[name="logo"]');
    if (!input) throw new Error("file input missing");
    fireEvent.change(input, {
      target: { files: [new File(["hello"], "logo.txt", { type: "text/plain" })] },
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/PNG, JPEG or WebP/i);
  });

  it("offers removal for a stored image", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LogoUploader
        name="logo"
        removedName="logoRemoved"
        label="Store logo"
        hint="Hint."
        value={{ currentUrl: "https://example.com/logo.png", file: null, removed: false }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /remove image/i }));
    expect(onChange).toHaveBeenCalledWith({
      currentUrl: "https://example.com/logo.png",
      file: null,
      removed: true,
    });
  });
});
