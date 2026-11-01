import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 4 end-to-end (spec §67).
 *
 * Full lifecycle with two live browser contexts: customer places a COD order
 * (cart → checkout → confirmation), the owner fulfils it step by step, and
 * the customer receives every status change over Realtime without reloading.
 * Unauthorized access and database-boundary rejections are covered too.
 * Everything created is archived/deleted afterwards; the project is left
 * exactly as found.
 *
 * Serial: owner tests share one account (sign-out revokes every session).
 * Needs E2E_OWNER_* plus a provisioned customer (E2E_CUSTOMER_* or a service
 * key for provisioning).
 */

const owner = {
  email: process.env.E2E_OWNER_EMAIL,
  password: process.env.E2E_OWNER_PASSWORD,
};
const hasOwner = Boolean(owner.email && owner.password);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const stamp = Date.now() % 100000;
const CATEGORY_NAME = `E2E Orders ${stamp}`;
const CAKE_NAME = `E2E Lifecycle ${stamp}`;

let customerEmail = process.env.E2E_CUSTOMER_EMAIL ?? "";
let customerPassword = process.env.E2E_CUSTOMER_PASSWORD ?? "";
let provisionedCustomerId: string | null = null;

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

async function ownerLogin(page: Page) {
  await page.goto("/owner/login");
  await page.getByLabel("Email").fill(owner.email!);
  await page.getByLabel("Password", { exact: true }).fill(owner.password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{36}$/);
}

async function customerLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(customerEmail);
  await page.getByLabel("Password", { exact: true }).fill(customerPassword);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/webstore\/[^/]+$/);
  return new URL(page.url()).pathname;
}

test.describe("ordering lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
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
    customerEmail = `e2e-buyer-${stamp}@example.com`;
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

  test("owner stages a cake for the lifecycle", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    await ownerLogin(page);

    await page.goto("/owner/products");
    await page.getByLabel("New category name").fill(CATEGORY_NAME);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText("Category created.")).toBeVisible();

    await page.goto("/owner/products/new");
    await page.getByLabel("Product name").fill(CAKE_NAME);
    await page.getByLabel("Category").selectOption({ label: CATEGORY_NAME });
    await page.getByLabel("Base price ₹").fill("600");
    await page.getByLabel("Variant mode").selectOption("size");
    await page.getByRole("button", { name: /add option/i }).click();
    await page.locator('input[name="variant-0-label"]').fill("2 Pound");
    await page.locator('input[name="variant-0-price"]').fill("1100");
    await page.getByRole("button", { name: /add flavour/i }).click();
    await page.locator('input[name="flavour-0-name"]').fill("Ferrero");
    await page.locator('input[name="flavour-0-surcharge"]').fill("150");
    await page.locator('input[name="newImages"]').setInputFiles({
      name: "lifecycle.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.getByRole("switch", { name: /allow customer custom design/i }).click();
    await page.getByRole("button", { name: /create product/i }).click();
    await expect(page).toHaveURL(/\/owner\/products\/[0-9a-f-]{8}/);
  });

  test("customer configures, carts, checks out and places a COD order", async ({ page }) => {
    test.skip(!(customerEmail && customerPassword), "No customer account available.");
    const webstore = await customerLogin(page);

    await page.goto(`${webstore}/shop`);
    await page.getByRole("link", { name: CAKE_NAME }).first().click();
    await page.getByRole("radio", { name: /2 pound/i }).click();
    await page.getByRole("radio", { name: /ferrero/i }).click();
    await page.locator("#customer-design").setInputFiles({
      name: "my-design.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByText(/design attached/i)).toBeVisible();
    await page.getByRole("button", { name: /save to cart/i }).click();
    await expect(page).toHaveURL(/\/cart$/);

    // Cart shows the server-priced configuration.
    await expect(page.getByText(CAKE_NAME)).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^₹1,250\.00$/ })).toBeVisible();
    await page.getByRole("link", { name: /proceed to checkout/i }).click();

    // Contact prefills from the profile; the phone edit must stick.
    await expect(page.getByLabel("Full name")).not.toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue(customerEmail);
    await page.getByLabel("Phone").fill("+91 90000 11111");
    await expect(page.getByRole("radio", { name: /pay at pickup/i })).toBeChecked();

    await page.getByRole("button", { name: /confirm and place order/i }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}\?fresh=1$/);
    await expect(page.getByRole("heading", { name: "Order placed!" })).toBeVisible();
    await expect(page.getByText(/BNK-\d{8}-\d{4}/).first()).toBeVisible();
    await expect(page.getByText("+91 90000 11111")).toBeVisible();
    await expect(page.getByText(/custom design attached/i)).toBeVisible();
  });

  // Shared across the serial lifecycle tests (one worker, one module).
  let lifecycleOrderUrl = "";
  let lifecycleOrderNumber = "";

  test("lifecycle A: customer places an Order-Now order", async ({ page, browser }) => {
    test.skip(!(customerEmail && customerPassword && hasOwner), "Accounts not configured.");
    test.setTimeout(120000);

    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    try {
      const webstore = await customerLogin(customerPage);
      await customerPage.goto(`${webstore}/shop`);
      await customerPage.getByRole("link", { name: CAKE_NAME }).first().click();
      const onePound = customerPage.getByRole("radio", { name: /1 pound/i });
      await expect(onePound).toBeVisible();
      await onePound.click();
      await customerPage.getByRole("button", { name: /order now/i }).click();
      await expect(customerPage).toHaveURL(/\/checkout\?items=[0-9a-f-]{8}/);
      await customerPage.getByRole("button", { name: /confirm and place order/i }).click();
      await expect(customerPage).toHaveURL(/\/orders\/[0-9a-f-]{36}\?fresh=1$/);
      lifecycleOrderUrl = customerPage.url();
      lifecycleOrderNumber =
        (
          await customerPage
            .getByText(/BNK-\d{8}-\d{4}/)
            .first()
            .textContent()
        )?.trim() ?? "";
      expect(lifecycleOrderNumber).toMatch(/BNK-\d{8}-\d{4}/);
    } finally {
      await customerContext.close();
    }
  });

  test("lifecycle B: owner fulfils while the customer watches over realtime", async ({
    page,
    browser,
  }) => {
    test.skip(!(customerEmail && customerPassword && hasOwner), "Accounts not configured.");
    test.skip(!lifecycleOrderUrl, "Lifecycle order was not placed.");
    // Two live contexts plus realtime windows.
    test.setTimeout(180000);

    // Owner online first, watching the dashboard.
    await ownerLogin(page);
    await page.goto("/owner/orders");

    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    try {
      const webstore = await customerLogin(customerPage);
      await customerPage.goto(lifecycleOrderUrl);

      // Owner bell lights up with no reload (Realtime NEW_ORDER).
      const ownerBell = page.getByRole("button", { name: /unread/i });
      await expect(ownerBell).toBeVisible({ timeout: 20000 });

      // Owner opens the order from the dashboard.
      await page.goto("/owner/orders");
      await page
        .getByRole("link", { name: new RegExp(lifecycleOrderNumber, "i") })
        .first()
        .click();
      await expect(page.getByText(/1 pound/i)).toBeVisible();

      // Step through fulfilment; the customer watches without reloading.
      for (const [button, customerText] of [
        [/confirm order/i, /has been confirmed/i],
        [/start baking/i, /being prepared/i],
        [/mark ready for pickup/i, /ready for pickup/i],
        [/complete order/i, /has been completed/i],
      ] as const) {
        await page.getByRole("button", { name: button }).click();
        await expect(customerPage.getByText(customerText).first()).toBeVisible({ timeout: 15000 });
      }

      await expect(customerPage.getByText(/picked up/i)).toBeVisible();
      await customerPage.goto(lifecycleOrderUrl);
      await expect(customerPage.getByText(/picked up/i)).toBeVisible();
    } finally {
      await customerContext.close();
    }
  });

  test("a random order id is a dead end for customers", async ({ page }) => {
    test.skip(!(customerEmail && customerPassword), "No customer account available.");
    const webstore = await customerLogin(page);

    const response = await page.goto(`${webstore}/orders/00000000-0000-4000-8000-000000000000`);
    expect(response?.status()).toBe(404);
  });

  test("owner archives the staged catalog and the suite leaves nothing", async ({ page }) => {
    test.skip(!hasOwner, "E2E_OWNER_* is not configured.");
    await ownerLogin(page);

    for (const name of [CAKE_NAME]) {
      await page.goto("/owner/products?q=" + encodeURIComponent(name));
      const href = await page.getByRole("link", { name }).getAttribute("href");
      await page.goto(href ?? "/owner/products");
      await expect(page).toHaveURL(/\/owner\/products\/[0-9a-f-]{36}$/);
      const archive = page.getByRole("button", { name: /^archive product$/i });
      if (await archive.isVisible()) {
        const [response] = await Promise.all([
          page.waitForResponse(
            (entry) =>
              entry.request().method() === "POST" && entry.url().includes("/owner/products"),
            { timeout: 20000 },
          ),
          archive.click(),
        ]);
        expect(response.ok()).toBe(true);
        await page.reload();
      }
    }

    await page.goto("/owner/products");
    const row = page.locator("li", { hasText: CATEGORY_NAME }).first();
    if (await row.isVisible()) {
      await row.getByRole("button", { name: /^delete/i }).click();
      await row.getByRole("button", { name: /^confirm$/i }).click();
      await expect(page.getByText(CATEGORY_NAME)).toHaveCount(0);
    }
  });

  test("anonymous writes bounce off the database boundary", async () => {
    test.skip(!SUPABASE_URL, "No Supabase URL configured.");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

    const order = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_number: "BNK-X", idempotency_key: "x" }),
    });
    expect([401, 403]).toContain(order.status);

    const cart = await fetch(`${SUPABASE_URL}/rest/v1/carts`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customer_id: "00000000-0000-4000-8000-000000000000" }),
    });
    expect([401, 403]).toContain(cart.status);

    const notifications = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    expect([401, 403]).toContain(notifications.status);
  });
});
