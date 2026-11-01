import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * The suite runs against a production build (`next build && next start`) so the
 * proxy, headers and CSP are exercised exactly as deployed. Chromium is used for
 * both a mobile and a desktop profile — the app targets mobile first, then
 * scales up.
 *
 * Authenticated journeys need a dedicated Supabase test project plus confirmed
 * test accounts; `tests/e2e/authenticated.spec.ts` skips itself when those
 * credentials are absent, so the default suite is safe to run anywhere.
 */
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

/**
 * Optional browser channel.
 *
 * CI installs Playwright's bundled Chromium. On a machine where that download
 * is unavailable, set `PLAYWRIGHT_CHANNEL=msedge` (or `chrome`) to use an
 * already-installed browser instead — same engine, same tests.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL;
const channelOptions = channel ? { channel } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 5"], ...channelOptions } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], ...channelOptions } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
  },
});
