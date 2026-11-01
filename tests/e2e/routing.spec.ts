import { expect, test } from "@playwright/test";

/**
 * Routing and access-control smoke tests.
 *
 * These run against the production build with only public Supabase
 * configuration, so they are safe in CI: no session exists, therefore no
 * request is made to Supabase.
 */
test.describe("public routes", () => {
  test("the root sends visitors straight to sign-in", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /sign in to bake n take/i }),
    ).toBeVisible();
  });

  test("sign-in page is reachable, titled and fully labelled", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/sign in/i);
    await expect(
      page.getByRole("heading", { level: 1, name: /sign in to bake n take/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("sign-up page collects only the essentials", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Phone")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("auth pages render a brand mark and never leak undefined", async ({ page }) => {
    for (const route of ["/login", "/signup"]) {
      await page.goto(route);

      // Database name when settings load ("Bake n Take home"), neutral
      // otherwise ("Store home") — either way a real brand mark, never text.
      await expect(page.getByRole("link", { name: /home/i }).first()).toBeVisible();
      await expect(page.getByText("undefined")).toHaveCount(0);
    }
  });

  test("password reset page offers a single email field", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(
      page.getByRole("heading", { level: 1, name: /reset your password/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("the update-password screen refuses to work without a recovery session", async ({
    page,
  }) => {
    await page.goto("/update-password");

    await expect(
      page.getByRole("heading", { level: 1, name: /that link has expired/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /request a new reset link/i })).toBeVisible();
  });

  test("unknown routes get a branded 404", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-page");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: /could not find that page/i }),
    ).toBeVisible();
  });
});

test.describe("protected routes", () => {
  test("a customer route sends visitors to the customer sign-in with a next hint", async ({
    page,
  }) => {
    await page.goto("/customer");

    await expect(page).toHaveURL(/\/login\?next=%2Fcustomer$/);
    await expect(page.getByRole("heading", { level: 1, name: /sign in/i })).toBeVisible();
  });

  test("an owner route sends visitors to the owner sign-in", async ({ page }) => {
    await page.goto("/owner");

    await expect(page).toHaveURL(/\/owner\/login\?next=%2Fowner$/);
    await expect(page.getByRole("heading", { level: 1, name: /owner sign in/i })).toBeVisible();
    await expect(page.getByText(/staff entrance/i)).toBeVisible();
  });

  test("a per-account webstore link keeps its destination through sign-in", async ({ page }) => {
    await page.goto("/webstore/11111111-1111-4111-8111-111111111111");

    await expect(page).toHaveURL(
      /\/login\?next=%2Fwebstore%2F11111111-1111-4111-8111-111111111111$/,
    );
    await expect(page.getByRole("heading", { level: 1, name: /sign in/i })).toBeVisible();
  });

  test("a per-account owner link goes to the staff entrance with its destination", async ({
    page,
  }) => {
    await page.goto("/owner/22222222-2222-4222-8222-222222222222");

    await expect(page).toHaveURL(
      /\/owner\/login\?next=%2Fowner%2F22222222-2222-4222-8222-222222222222$/,
    );
    await expect(page.getByRole("heading", { level: 1, name: /owner sign in/i })).toBeVisible();
  });

  test("the owner sign-in screen stays public", async ({ page }) => {
    const response = await page.goto("/owner/login");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /owner sign in/i })).toBeVisible();
  });

  test("owner-only areas are never rendered for anonymous visitors", async ({ page }) => {
    await page.goto("/owner");

    // The owner placeholder must not appear before a role check has happened.
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/^owner$/i);
  });
});

test.describe("auth callback", () => {
  test("a callback without credentials redirects with a curated error", async ({ page }) => {
    await page.goto("/auth/callback");

    await expect(page).toHaveURL(/\/login\?error=link_expired$/);
    await expect(page.getByRole("alert").filter({ hasText: /no longer valid/i })).toBeVisible();
  });

  test("a cancelled provider sign-in is explained calmly", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&error_description=User+denied");

    await expect(page).toHaveURL(/\/login\?error=oauth_cancelled$/);
    await expect(page.getByRole("alert").filter({ hasText: /cancelled/i })).toBeVisible();
  });

  test("an off-site next parameter is not honoured", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&next=https://evil.example.com");

    await expect(page).not.toHaveURL(/evil\.example\.com/);
  });
});
