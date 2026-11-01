/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RedirectSignal } from "@/tests/helpers/supabase-mock";
import { WEEK_DAYS } from "@/lib/store/types";

vi.mock("@/lib/auth/session", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

import { revalidatePath, updateTag } from "next/cache";

import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { updateStoreSettingsAction } from "./actions";

const requireOwnerMock = vi.mocked(requireOwner);
const createClientMock = vi.mocked(createClient);
const updateTagMock = vi.mocked(updateTag);
const revalidatePathMock = vi.mocked(revalidatePath);

const INITIAL_STATE = { status: "idle" as const };

const OWNER_SESSION = {
  user: { id: "owner-id" },
  profile: {
    id: "owner-id",
    fullName: "Owner",
    email: "owner@example.com",
    phone: null,
    role: "OWNER",
    status: "ACTIVE",
  },
};

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function validForm(overrides: Record<string, string> = {}): FormData {
  return form({
    storeName: "Bake n Take",
    tagline: "Fresh",
    description: "Bakery",
    phonePrimary: "",
    phoneSecondary: "",
    email: "",
    whatsapp: "",
    addressLine1: "",
    addressLine2: "",
    locality: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    mapsUrl: "",
    latitude: "",
    longitude: "",
    socialsJson: "{}",
    hoursJson: JSON.stringify(
      Object.fromEntries(
        WEEK_DAYS.map((day) => [day, { open: true, opens_at: "09:00", closes_at: "21:00" }]),
      ),
    ),
    pickupInstructions: "",
    pickupLocation: "",
    pickupNotes: "",
    pickupEta: "",
    isOpen: "1",
    acceptingOrders: "1",
    statusMessage: "",
    currency: "INR",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    logoRemoved: "0",
    aboutBannerRemoved: "0",
    ...overrides,
  });
}

function supabaseMock() {
  const client = {
    from: vi.fn(() => queryMock),
    storage: { from: vi.fn(() => storageMock) },
  };
  return { client };
}

const queryMock = {
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
};

const storageMock = {
  upload: vi.fn(async (...args: unknown[]) => ({ error: null, path: args[0] as string })),
  remove: vi.fn(async () => ({})),
};

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerMock.mockResolvedValue(OWNER_SESSION as never);
  queryMock.select.mockReturnValue(queryMock);
  queryMock.eq.mockReturnValue(queryMock);
  queryMock.update.mockReturnValue(queryMock);
  queryMock.maybeSingle.mockResolvedValue({ data: { logo_path: null, favicon_path: null } });
});

describe("updateStoreSettingsAction", () => {
  it("bounces non-owners before touching anything", async () => {
    requireOwnerMock.mockRejectedValueOnce(new RedirectSignal("/owner/login?next=%2Fowner"));
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    await expect(updateStoreSettingsAction(INITIAL_STATE, validForm())).rejects.toBeInstanceOf(
      RedirectSignal,
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reports validation failures without writing", async () => {
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    const state = await updateStoreSettingsAction(
      INITIAL_STATE,
      validForm({ storeName: "  ", currency: "INR!" }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.storeName).toBeTruthy();
    expect(client.from).not.toHaveBeenCalledWith("store_settings");
  });

  it("saves valid settings and revalidates the storefront", async () => {
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    const state = await updateStoreSettingsAction(INITIAL_STATE, validForm({ city: "Mumbai" }));

    expect(state).toEqual({ status: "success", message: "Store settings saved." });
    expect(queryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ store_name: "Bake n Take", city: "Mumbai", currency: "INR" }),
    );
    expect(updateTagMock).toHaveBeenCalledWith("store-settings");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects a non-image logo without uploading", async () => {
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    const body = validForm();
    body.set("logo", new File(["not an image"], "logo.txt", { type: "text/plain" }));

    const state = await updateStoreSettingsAction(INITIAL_STATE, body);

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/PNG, JPEG or WebP/i);
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("uploads a valid logo, stores the path and retires the old file", async () => {
    queryMock.maybeSingle.mockResolvedValue({
      data: { logo_path: "logos/old.png", favicon_path: null },
    });
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    // Minimal PNG: signature + IHDR declaring 1x1.
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    ]);
    const body = validForm();
    body.set("logo", new File([png], "logo.png", { type: "image/png" }));

    const state = await updateStoreSettingsAction(INITIAL_STATE, body);

    expect(state.status).toBe("success");
    expect(storageMock.upload).toHaveBeenCalledTimes(1);
    const uploadedPath = storageMock.upload.mock.calls[0][0] as string;
    expect(uploadedPath.startsWith("logos/")).toBe(true);
    expect(queryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ logo_path: uploadedPath }),
    );
    expect(storageMock.remove).toHaveBeenCalledWith(["logos/old.png"]);
  });

  it("refuses to save when the current row cannot be read", async () => {
    queryMock.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    const state = await updateStoreSettingsAction(INITIAL_STATE, validForm());

    expect(state.status).toBe("error");
    // Nothing may be uploaded or written when the baseline is unknown —
    // proceeding with nulled paths would wipe the stored brand files.
    expect(storageMock.upload).not.toHaveBeenCalled();
    expect(queryMock.update).not.toHaveBeenCalled();
  });

  it("keeps stored About content when aboutJson is absent", async () => {
    queryMock.maybeSingle.mockResolvedValue({
      data: {
        logo_path: null,
        favicon_path: null,
        about: { heading: "Kept heading", banner_path: "banners/about/kept.png" },
      },
    });
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    const state = await updateStoreSettingsAction(INITIAL_STATE, validForm());

    expect(state.status).toBe("success");
    expect(queryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        about: expect.objectContaining({
          heading: "Kept heading",
          banner_path: "banners/about/kept.png",
        }),
      }),
    );
    expect(storageMock.remove).not.toHaveBeenCalled();
  });

  it("uploads an about banner under banners/about and stores its path", async () => {
    const { client } = supabaseMock();
    createClientMock.mockResolvedValue(client as never);

    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    ]);
    const body = validForm({
      aboutJson: JSON.stringify({
        enabled: true,
        eyebrow: "Hello",
        heading: "Our bakery",
        body: "Fresh daily.",
        secondary: "",
        cta_label: "Shop",
        cta_href: "/shop",
        banner: "cupcakes",
      }),
    });
    body.set("aboutBanner", new File([png], "banner.png", { type: "image/png" }));

    const state = await updateStoreSettingsAction(INITIAL_STATE, body);

    expect(state.status).toBe("success");
    const uploadedPath = storageMock.upload.mock.calls[0][0] as string;
    expect(uploadedPath.startsWith("banners/about/")).toBe(true);
    expect(queryMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        about: expect.objectContaining({ banner: "cupcakes", banner_path: uploadedPath }),
      }),
    );
  });
});
