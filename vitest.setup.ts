import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Shared test environment.
 *
 * Placeholder Supabase credentials are injected *before* any module is imported,
 * so `lib/env.ts` can be loaded without a real project. Every Supabase call is
 * replaced with a test double, therefore no request ever leaves the process.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://test-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= "sb_publishable_test_key_for_unit_tests";

afterEach(() => {
  cleanup();
});
