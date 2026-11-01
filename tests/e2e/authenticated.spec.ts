import { expect, test } from "@playwright/test";

/**
 * End-to-end journeys that need real accounts.
 *
 * These are skipped unless a dedicated test project (or test accounts inside a
 * development project) is configured, so the default suite never depends on
 * live data and never runs against production:
 *
 *   E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD
 *   E2E_OWNER_EMAIL    / E2E_OWNER_PASSWORD
 *
 * See docs/TESTING.md for how to provision them.
 */
const customer = {
  email: process.env.E2E_CUSTOMER_EMAIL,
  password: process.env.E2E_CUSTOMER_PASSWORD,
};

const owner = {
  email: process.env.E2E_OWNER_EMAIL,
  password: process.env.E2E_OWNER_PASSWORD,
};

const hasCustomer = Boolean(customer.email && customer.password);
const hasOwner = Boolean(owner.email && owner.password);
const hasAny = hasCustomer || hasOwner;

test.describe("authenticated journeys", () => {
  test.skip(!hasAny, "Set E2E_CUSTOMER_*/E2E_OWNER_* to run the authenticated suites.");

  test("a customer signs in, lands on their webstore page, and signs out", async ({ page }) => {
    test.skip(!hasCustomer, "E2E_CUSTOMER_* is not configured.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(customer.email!);
    await page.getByLabel("Password", { exact: true }).fill(customer.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/webstore\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: /^customer$/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /^customer$/i })).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed_out$/);
  });

  test("a customer cannot reach the owner area", async ({ page }) => {
    test.skip(!hasCustomer, "E2E_CUSTOMER_* is not configured.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(customer.email!);
    await page.getByLabel("Password", { exact: true }).fill(customer.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/webstore\/[^/]+$/);

    await page.goto("/owner");
    await expect(page).toHaveURL(/\/webstore\/[^/]+\?error=not_authorized$/);
    await expect(page.getByRole("alert").filter({ hasText: /do not have access/i })).toBeVisible();
  });

  test("a customer who tries another account's webstore URL lands on their own", async ({
    page,
  }) => {
    test.skip(!hasCustomer, "E2E_CUSTOMER_* is not configured.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(customer.email!);
    await page.getByLabel("Password", { exact: true }).fill(customer.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/webstore\/[^/]+$/);

    await page.goto("/webstore/00000000-0000-4000-8000-000000000000");
    await expect(page).toHaveURL(/\/webstore\/[^/]+$/);
    await expect(page).not.toHaveURL(/00000000-0000-4000-8000-000000000000/);
  });

  test("a customer cannot sign in through the owner entrance", async ({ page }) => {
    test.skip(!hasCustomer, "E2E_CUSTOMER_* is not configured.");

    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(customer.email!);
    await page.getByLabel("Password", { exact: true }).fill(customer.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByRole("alert").filter({ hasText: /owner access/i })).toBeVisible();
    await expect(page).not.toHaveURL(/\/owner\/(?!login)[^/]+$/);
  });

  test("an owner signs in and reaches their owner page", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");

    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(owner.email!);
    await page.getByLabel("Password", { exact: true }).fill(owner.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{8,}$/);
    await expect(page.getByRole("heading", { level: 1, name: /^dashboard$/i })).toBeVisible();
  });
});
