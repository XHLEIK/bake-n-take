import { expect, test } from "@playwright/test";

/**
 * Security header and CSP verification.
 *
 * These assertions run against the production build, so they prove the headers
 * a deployed environment will send — not just what the configuration intends.
 */
test.describe("security headers", () => {
  test("hardening headers are present on pages", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response?.headers() ?? {};

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the content security policy is nonce based and closes the obvious doors", async ({
    page,
  }) => {
    const response = await page.goto("/login");
    const csp = response?.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("a fresh nonce is issued per request", async ({ request }) => {
    const first = await request.get("/login");
    const second = await request.get("/login");

    const nonceOf = (value: string | undefined) => value?.match(/'nonce-([^']+)'/)?.[1];

    expect(nonceOf(first.headers()["content-security-policy"])).toBeTruthy();
    expect(nonceOf(first.headers()["content-security-policy"])).not.toBe(
      nonceOf(second.headers()["content-security-policy"]),
    );
  });

  test("link and script tags receive the nonce, so nothing is blocked", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy|csp/i.test(message.text())) violations.push(message.text());
    });

    await page.goto("/login");
    await page.getByRole("button", { name: /show password/i }).click();

    expect(violations).toEqual([]);
  });

  test("the theme cookie is scoped and lax", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /^theme:/i }).click();

    const cookie = (await page.context().cookies()).find((item) => item.name === "bnt-theme");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");
  });
});
