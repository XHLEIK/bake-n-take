import { expect, test } from "@playwright/test";

/**
 * Authentication UI behaviour: error surfacing, input affordances, theming and
 * mobile ergonomics. Nothing here needs a session or a live Supabase project.
 */
test.describe("message handling", () => {
  test("shows the curated message for a failed sign-in redirect", async ({ page }) => {
    await page.goto("/login?error=invalid_credentials");

    await expect(
      page.getByRole("alert").filter({ hasText: /email and password combination is not correct/i }),
    ).toBeVisible();
  });

  test("never echoes untrusted text from the query string", async ({ page }) => {
    await page.goto("/login?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E&notice=whatever");

    // Next.js renders its own empty route announcer with role="alert", so only
    // alerts that actually say something count here.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
    await expect(page.getByText(/<script>/i)).toHaveCount(0);
    await expect(page.locator("script:has-text('alert(1)')")).toHaveCount(0);
  });

  test("a retired confirmation notice renders nothing to resend", async ({ page }) => {
    // Email confirmation was removed: an old verify_email link must not offer
    // a resend path or render any notice text.
    await page.goto("/login?notice=verify_email");

    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /resend confirmation email/i })).toHaveCount(0);
  });

  test("names an expired session in plain language", async ({ page }) => {
    await page.goto("/login?error=session_expired");

    await expect(page.getByRole("alert").filter({ hasText: /session has ended/i })).toBeVisible();
  });
});

test.describe("input affordances", () => {
  test("password can be revealed and hidden", async ({ page }) => {
    await page.goto("/login");

    const password = page.getByLabel("Password", { exact: true });
    await password.fill("sourdough1");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: /show password/i }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("password rules update live while typing", async ({ page }) => {
    await page.goto("/signup");

    const rules = page.getByRole("list").filter({ hasText: /at least 8 characters/i });
    await expect(rules).toContainText(/not met yet/i);

    await page.getByLabel("Password", { exact: true }).fill("sourdough1");
    await expect(rules.locator("li").first()).toContainText(/— met/i);
  });

  test("required fields are not submitted when empty", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Email")).toHaveJSProperty("validity.valueMissing", true);
  });
});

test.describe("theme", () => {
  test("cycles through light and dark and remembers the choice", async ({ page }) => {
    await page.goto("/login");

    const html = page.locator("html");
    const toggle = page.getByRole("button", { name: /^theme:/i });

    // Fresh visitors start on "system": light → dark → system.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", /theme: light/i);

    await toggle.click();
    await expect(html).toHaveClass(/dark/);

    await page.reload();
    await expect(html).toHaveClass(/dark/);
    await expect(toggle).toHaveAttribute("aria-label", /theme: dark/i);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", /theme: system/i);
  });

  test("applies the saved theme before the first paint", async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "bnt-theme", value: "dark", url: "http://127.0.0.1:3100" }]);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("mobile ergonomics", () => {
  test("no horizontal overflow and comfortable touch targets", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "mobile layout check");

    await page.goto("/login");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    for (const name of [/^sign in$/i, /continue with google/i]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }
  });

  test("keyboard users can move from field to field with a visible focus ring", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();

    const outline = await focused.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(outline).toBe(true);
  });
});
