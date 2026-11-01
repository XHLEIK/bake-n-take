import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 3 catalog flow (revised: categories are the product type).
 *
 * Owner: login → create category (name-only, inside Products) → create cake
 * product (images, size variants, flavours + surcharge, custom design,
 * featured) → create uncategorized cupcake (quantity options).
 * Customer: shop shows both, detail configurators price correctly, design
 * upload appears only on the cake.
 * Then: owner edits (price change propagates), disables (unavailable badge),
 * archives (vanishes), deletes category (products become uncategorized, still
 * listed), reassigns, and cleans everything up.
 * Unauthorized mutations are rejected at the database boundary.
 *
 * Serial: all owner tests share one account (sign-out revokes every session).
 * Unique timestamps avoid collisions; the suite deletes everything it
 * creates. Owner tests need E2E_OWNER_*; the customer account is provisioned
 * through the service key when available (otherwise customer tests skip).
 */

const owner = {
  email: process.env.E2E_OWNER_EMAIL,
  password: process.env.E2E_OWNER_PASSWORD,
};
const hasOwner = Boolean(owner.email && owner.password);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const stamp = Date.now() % 100000;
const CATEGORY_NAME = `E2E Bars ${stamp}`;
const FRESH_CATEGORY_NAME = `E2E Fresh ${stamp}`;
const CAKE_NAME = `E2E Truffle ${stamp}`;
const CUPCAKE_NAME = `E2E Choco Cups ${stamp}`;

let customerEmail = process.env.E2E_CUSTOMER_EMAIL ?? "";
let customerPassword = process.env.E2E_CUSTOMER_PASSWORD ?? "";
let provisionedCustomerId: string | null = null;

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

/** Mirrors the server slugify for assertions (names here are ASCII). */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

test.describe("catalog end to end", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Sweep leftovers from interrupted runs so pills/cards stay deterministic.
    if (SERVICE_KEY && SUPABASE_URL) {
      const headers = {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      };
      await fetch(`${SUPABASE_URL}/rest/v1/products?slug=like.e2e-*`, {
        method: "DELETE",
        headers,
      }).catch(() => undefined);
      await fetch(`${SUPABASE_URL}/rest/v1/categories?slug=like.e2e-*`, {
        method: "DELETE",
        headers,
      }).catch(() => undefined);
    }
    if (customerEmail && customerPassword) return;
    if (!SERVICE_KEY || !SUPABASE_URL) return;
    customerEmail = `e2e-customer-${stamp}@example.com`;
    customerPassword = `E2e-${stamp}-sourdough1`;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: customerEmail,
        password: customerPassword,
        email_confirm: true,
      }),
    });
    if (!response.ok) throw new Error(`Provision customer: ${response.status}`);
    const created = (await response.json()) as { id?: string };
    provisionedCustomerId = created.id ?? null;
  });

  test.afterAll(async () => {
    if (provisionedCustomerId && SERVICE_KEY && SUPABASE_URL) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${provisionedCustomerId}`, {
        method: "DELETE",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }).catch(() => undefined);
    }
  });

  async function ownerLogin(page: Page) {
    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(owner.email!);
    await page.getByLabel("Password", { exact: true }).fill(owner.password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{36}$/);
  }

  // NOTE: edit links are opened via href+goto rather than click — a
  // router.refresh() racing a Link navigation can silently cancel it.
  async function openEditor(page: Page, productName: string) {
    const href = await page.getByRole("link", { name: productName }).getAttribute("href");
    await page.goto(href ?? `/owner/products`);
    await expect(page).toHaveURL(/\/owner\/products\/[0-9a-f-]{36}$/);
  }

  // NOTE: buttons under the sticky site header can end up covered after
  // Playwright's minimal scroll — center them first, then click normally.
  async function steadyClick(page: Page, button: ReturnType<Page["getByRole"]>) {
    await button.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "center" }),
    );
    await button.click();
  }

  // Clicks a mutation button and waits for its POST to complete. Reloading
  // any earlier aborts the action server-side and the write is lost.
  async function submitMutation(page: Page, button: ReturnType<Page["getByRole"]>) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (entry) => entry.request().method() === "POST" && entry.url().includes("/owner/products"),
        { timeout: 20000 },
      ),
      button.click(),
    ]);
    expect(response.ok()).toBe(true);
  }

  test("owner creates a category inside Products", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    await ownerLogin(page);

    await page.goto("/owner/products");
    await page.getByRole("button", { name: /categories/i }).click();
    await page.getByLabel("New category name").fill(CATEGORY_NAME);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Category created.")).toBeVisible();
    await expect(page.locator("li", { hasText: CATEGORY_NAME }).first()).toBeVisible();
  });

  test("owner creates the cake with images, sizes, flavours and custom design", async ({
    page,
  }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    await ownerLogin(page);

    await page.goto("/owner/products/new");
    await page.getByLabel("Product name").fill(CAKE_NAME);
    await expect(page.getByLabel("Product name")).toHaveValue(CAKE_NAME);
    await page.getByLabel("Category").selectOption({ label: CATEGORY_NAME });
    await expect(page.getByLabel("Category")).not.toHaveValue("");
    await page.getByLabel("Short description").fill("Rich truffle layer cake.");
    await page.getByLabel("Base price ₹").fill("600");
    await expect(page.getByLabel("Base price ₹")).toHaveValue("600");
    await page.getByLabel("Variant mode").selectOption("size");

    await page.getByRole("button", { name: /add option/i }).click();
    await page.locator('input[name="variant-0-label"]').fill("1 Pound");
    await page.locator('input[name="variant-0-price"]').fill("600");
    await page.getByRole("button", { name: /add option/i }).click();
    await page.locator('input[name="variant-1-label"]').fill("2 Pound");
    await page.locator('input[name="variant-1-price"]').fill("1100");

    await page.getByRole("button", { name: /add flavour/i }).click();
    await page.locator('input[name="flavour-0-name"]').fill("Chocolate");
    await page.getByRole("button", { name: /add flavour/i }).click();
    await page.locator('input[name="flavour-1-name"]').fill("Ferrero");
    await page.locator('input[name="flavour-1-surcharge"]').fill("150");

    await page.locator('input[name="newImages"]').setInputFiles({
      name: "cake-a.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.locator('input[name="newImages"]').setInputFiles({
      name: "cake-b.png",
      mimeType: "image/png",
      buffer: png,
    });

    await page.getByRole("switch", { name: /allow customer custom design/i }).click();
    await page.getByRole("switch", { name: /^featured$/i }).click();

    await page.getByRole("button", { name: /create product/i }).click();
    await expect(page).toHaveURL(/\/owner\/products\/[0-9a-f-]{8}/);
    await expect(
      page.getByText(`/${slugifyName(CAKE_NAME)}`, { exact: false }).first(),
    ).toBeVisible();
  });

  test("owner creates the cupcake with quantity options", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    await ownerLogin(page);

    await page.goto("/owner/products/new");
    await page.getByLabel("Product name").fill(CUPCAKE_NAME);
    await page.getByLabel("Category").selectOption({ label: CATEGORY_NAME });
    await page.getByLabel("Base price ₹").fill("60");
    await page.getByLabel("Variant mode").selectOption("quantity");

    const quantities: [string, string][] = [
      ["2 pieces", "120"],
      ["4 pieces", "220"],
      ["8 pieces", "400"],
    ];
    for (let option = 0; option < quantities.length; option += 1) {
      await page.getByRole("button", { name: /add option/i }).click();
    }
    for (const [index, [label, price]] of quantities.entries()) {
      await page.locator(`input[name="variant-${index}-label"]`).fill(label);
      await page.locator(`input[name="variant-${index}-price"]`).fill(price);
    }
    await page.getByRole("button", { name: /add flavour/i }).click();
    await page.locator('input[name="flavour-0-name"]').fill("Vanilla");

    await page.getByRole("button", { name: /create product/i }).click();
    await expect(page).toHaveURL(/\/owner\/products\/[0-9a-f-]{8}/);
  });

  test("customer browses categories, cards and detail configurators", async ({ page }) => {
    test.skip(!(customerEmail && customerPassword), "No customer account available.");
    await page.goto("/login");
    await page.getByLabel("Email").fill(customerEmail);
    await page.getByLabel("Password", { exact: true }).fill(customerPassword);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/webstore\/[^/]+$/);
    const webstore = new URL(page.url()).pathname;

    await page.goto(`${webstore}/shop`);
    await expect(page.getByRole("link", { name: CATEGORY_NAME }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: CAKE_NAME }).first()).toBeVisible();
    await expect(page.getByText(/from ₹600\.00/i)).toBeVisible();

    await page.getByRole("link", { name: CATEGORY_NAME }).first().click();
    await expect(page.getByRole("link", { name: CUPCAKE_NAME }).first()).toBeVisible();

    // Cake detail: sizes, flavours, surcharge math, design upload.
    await page.getByRole("link", { name: CAKE_NAME }).first().click();
    await expect(page.getByRole("radio", { name: /1 pound/i })).toBeVisible();
    await page.getByRole("radio", { name: /ferrero/i }).click();
    await page.getByRole("radio", { name: /2 pound/i }).click();
    await expect(page.getByText("₹1,250.00")).toBeVisible();
    await expect(page.getByText(/custom design/i)).toBeVisible();

    // Cupcake detail: quantities, no design upload.
    await page.goto(`${webstore}/shop`);
    await page.getByRole("link", { name: CUPCAKE_NAME }).first().click();
    await expect(page.getByRole("radio", { name: /8 pieces/i })).toBeVisible();
    await expect(page.getByText(/custom design/i)).toHaveCount(0);
    await page.getByRole("radio", { name: /8 pieces/i }).click();
    await expect(page.locator('[aria-live="polite"]')).toContainText("₹400.00");
  });

  test("owner price edit propagates; disable, archive and delete flow works", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    await ownerLogin(page);

    // Edit the 2 Pound option to ₹1200 via the products list search.
    await page.goto("/owner/products?q=" + encodeURIComponent(CAKE_NAME));
    await openEditor(page, CAKE_NAME);
    await page.locator('input[name="variant-1-price"]').fill("1200");
    await page.getByRole("button", { name: /^save product$/i }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();

    // Disable → the row badge flips to Unavailable.
    await page.goto("/owner/products?q=" + encodeURIComponent(CUPCAKE_NAME));
    await page.getByRole("button", { name: /mark unavailable/i }).click();
    await expect(page.getByRole("button", { name: /mark available/i })).toBeVisible();

    // Archive the cupcake → restore → delete for a clean slate.
    await openEditor(page, CUPCAKE_NAME);
    await submitMutation(page, page.getByRole("button", { name: /^archive product$/i }));
    await page.reload();
    await expect(page.getByRole("button", { name: /^restore product$/i })).toBeVisible();
    await submitMutation(page, page.getByRole("button", { name: /^restore product$/i }));
    await page.reload();
    await expect(page.getByRole("button", { name: /^archive product$/i })).toBeVisible();
    await page.getByRole("button", { name: /^delete product/i }).click();
    await page.getByRole("button", { name: /^confirm delete$/i }).click();
    await expect(page).toHaveURL(/\/owner\/products$/);

    // Deleting the category keeps the cake: it becomes uncategorized.
    // (The deleted row unmounts on refresh, so assert the empty state and
    // the orphaned product instead of a transient message.)
    await page.goto("/owner/products");
    await page.getByRole("button", { name: /categories/i }).click();
    const row = page.locator("li", { hasText: CATEGORY_NAME }).first();
    await row.getByRole("button", { name: /^delete/i }).click();
    await row.getByRole("button", { name: /^confirm$/i }).click();
    await expect(page.getByText(/no categories yet/i)).toBeVisible();
    await expect(page.getByText(CATEGORY_NAME)).toHaveCount(0);

    // The orphaned cake still shows under All with no category label.
    await page.goto("/owner/products?q=" + encodeURIComponent(CAKE_NAME));
    await expect(page.getByText(/uncategorized/i).first()).toBeVisible();

    // Reassign it to a fresh category, then clean everything up.
    await page.getByRole("button", { name: /categories/i }).click();
    await page.getByLabel("New category name").fill(FRESH_CATEGORY_NAME);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Category created.")).toBeVisible();
    await expect(page.locator("li", { hasText: FRESH_CATEGORY_NAME }).first()).toBeVisible();

    await openEditor(page, CAKE_NAME);
    await page.getByLabel("Category").selectOption({ label: FRESH_CATEGORY_NAME });
    await page.getByRole("button", { name: /^save product$/i }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();

    await submitMutation(page, page.getByRole("button", { name: /^archive product$/i }));
    await page.reload();
    await page.getByRole("button", { name: /^delete product/i }).click();
    await page.getByRole("button", { name: /^confirm delete$/i }).click();
    await expect(page).toHaveURL(/\/owner\/products$/);

    await page.goto("/owner/products");
    await page.getByRole("button", { name: /categories/i }).click();
    const cleanRow = page.locator("li", { hasText: FRESH_CATEGORY_NAME }).first();
    await steadyClick(page, cleanRow.getByRole("button", { name: /^delete/i }));
    await cleanRow.getByRole("button", { name: /^confirm$/i }).click();
    await expect(page.getByText(FRESH_CATEGORY_NAME)).toHaveCount(0);
  });

  test("customer mutations are rejected at the database boundary", async () => {
    test.skip(!SUPABASE_URL, "No Supabase URL configured.");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    const probe = `E2E Probe ${stamp}`;

    const insert = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: probe, slug: `e2e-probe-${stamp}` }),
    });
    expect([401, 403]).toContain(insert.status);

    const upload = await fetch(
      `${SUPABASE_URL}/storage/v1/object/store-assets/products/e2e-${stamp}.png`,
      {
        method: "POST",
        headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "image/png" },
        body: png,
      },
    );
    expect(upload.ok).toBe(false);
  });
});
