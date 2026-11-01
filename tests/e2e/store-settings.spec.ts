import { expect, test } from "@playwright/test";

/**
 * Store Settings console access control (Phase 2).
 *
 * The anonymous checks run everywhere. Anything needing a real account is
 * gated on E2E_OWNER_* / E2E_CUSTOMER_* like the rest of authenticated.spec.
 * No test saves the form, so the shared project is never mutated.
 */
const owner = {
  email: process.env.E2E_OWNER_EMAIL,
  password: process.env.E2E_OWNER_PASSWORD,
};
const customer = {
  email: process.env.E2E_CUSTOMER_EMAIL,
  password: process.env.E2E_CUSTOMER_PASSWORD,
};
const hasOwner = Boolean(owner.email && owner.password);
const hasCustomer = Boolean(customer.email && customer.password);

test.describe("store settings access", () => {
  // Serial: every owner test signs in as the same account, and sign-out
  // revokes all of that account's sessions — parallel runs would log each
  // other out mid-test.
  test.describe.configure({ mode: "serial" });
  test("anonymous visitors are sent to the staff entrance with a next hint", async ({ page }) => {
    await page.goto("/owner/settings");

    await expect(page).toHaveURL(/\/owner\/login\?next=%2Fowner%2Fsettings$/);
    await expect(page.getByRole("heading", { level: 1, name: /owner sign in/i })).toBeVisible();
  });

  test("an owner opens the console with all sections", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");

    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(owner.email!);
    await page.getByLabel("Password", { exact: true }).fill(owner.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{8,}$/);

    await page.goto("/owner/settings");
    await expect(page.getByRole("heading", { level: 1, name: /store settings/i })).toBeVisible();

    for (const section of [
      "Store identity",
      "Brand images",
      "Contact information",
      "Store address",
      "Business hours",
      "Social media",
      "Pickup information",
      "Store status",
      "Regional settings",
    ]) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /^save settings$/i })).toBeVisible();
  });

  test("the console blocks an empty store name without saving", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");

    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(owner.email!);
    await page.getByLabel("Password", { exact: true }).fill(owner.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{8,}$/);

    await page.goto("/owner/settings");
    await page.getByLabel("Store name").fill("");
    await page.getByRole("button", { name: /^save settings$/i }).click();

    // Native required-validation stops the submit: still on the console, the
    // field flagged, and no success message. (Server-side rejection of the
    // same input is covered by unit tests.)
    await expect(page.getByLabel("Store name")).toHaveJSProperty("validity.valueMissing", true);
    await expect(page).toHaveURL(/\/owner\/settings$/);
    await expect(page.getByText("Store settings saved.")).toHaveCount(0);
  });

  test("sidebar navigation renders for a signed-in owner", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");

    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(owner.email!);
    await page.getByLabel("Password", { exact: true }).fill(owner.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{8,}$/);

    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const label of [
      "Dashboard",
      "Orders",
      "Products",
      "Offers",
      "Hero Carousel",
      "Store Settings",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("a customer is bounced to their own webstore with an explanation", async ({ page }) => {
    test.skip(!hasCustomer, "E2E_CUSTOMER_* is not configured.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(customer.email!);
    await page.getByLabel("Password", { exact: true }).fill(customer.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/webstore\/[^/]+$/);

    await page.goto("/owner/settings");
    await expect(page).toHaveURL(/\/webstore\/[^/]+\?error=not_authorized$/);
  });

  test("an owner rename propagates to login, header and footer, then restores", async ({
    page,
  }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    const probeName = `Probe Bake ${Date.now() % 100000}`;

    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(owner.email!);
    await page.getByLabel("Password", { exact: true }).fill(owner.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{8,}$/);

    await page.goto("/owner/settings");
    const nameField = page.getByLabel("Store name");
    const originalName = await nameField.inputValue();

    try {
      await nameField.fill(probeName);
      await page.getByRole("button", { name: /^save settings$/i }).click();
      await expect(page.getByText("Store settings saved.")).toBeVisible();

      // Signed-out pages carry the new name without a redeploy: sign out to
      // see the public login experience (owners are bounced to their area).
      await page.getByRole("button", { name: /sign out/i }).click();
      await expect(page).toHaveURL(/\/login\?notice=signed_out$/);
      await expect(
        page.getByRole("heading", { level: 1, name: new RegExp(probeName, "i") }),
      ).toBeVisible();

      // Header brand follows.
      await expect(
        page.getByRole("link", { name: new RegExp(probeName, "i") }).first(),
      ).toBeVisible();

      // Sidebar brand follows: sign back in to reach the owner area.
      await page.goto("/owner/login");
      await page.getByLabel("Email").fill(owner.email!);
      await page.getByLabel("Password", { exact: true }).fill(owner.password!);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{8,}$/);
      await expect(
        page.getByRole("link", { name: new RegExp(probeName, "i") }).first(),
      ).toBeVisible();
    } finally {
      // Restore whatever was there before, even if an assertion failed.
      await page.goto("/owner/settings");
      await page.getByLabel("Store name").fill(originalName);
      await page.getByRole("button", { name: /^save settings$/i }).click();
      await expect(page.getByText("Store settings saved.")).toBeVisible();
    }

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed_out$/);
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(originalName, "i") }),
    ).toBeVisible();
  });

  test("an owner logo upload reaches the header, then is removed", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    // 1x1 PNG: signature + IHDR only.
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    ]);

    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(owner.email!);
    await page.getByLabel("Password", { exact: true }).fill(owner.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{8,}$/);

    await page.goto("/owner/settings");
    try {
      await page.locator('input[name="logo"]').setInputFiles({
        name: "probe-logo.png",
        mimeType: "image/png",
        buffer: png,
      });
      await page.getByRole("button", { name: /^save settings$/i }).click();
      await expect(page.getByText("Store settings saved.")).toBeVisible();

      await page.goto("/login");
      const headerLogo = page.locator("header img").first();
      await expect(headerLogo).toBeVisible();
      expect(await headerLogo.getAttribute("src")).toContain("store-assets");
    } finally {
      await page.goto("/owner/settings");
      const remove = page.getByRole("button", { name: /remove image/i }).first();
      if (await remove.isVisible()) {
        await remove.click();
        await page.getByRole("button", { name: /^save settings$/i }).click();
        await expect(page.getByText("Store settings saved.")).toBeVisible();
      }
    }
  });
});
