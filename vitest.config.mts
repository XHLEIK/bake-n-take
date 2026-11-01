import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit and integration tests (Vitest).
 *
 * `tests/e2e` is excluded: those specs belong to Playwright. Integration tests
 * mock the Supabase boundary, so no test can ever touch a real project — see
 * `docs/TESTING.md`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      ".opencode/**",
      ".next/**",
      "tests/e2e/**",
      "test-results/**",
      "graphify-out/**",
    ],
    restoreMocks: true,
    clearMocks: true,
  },
});
