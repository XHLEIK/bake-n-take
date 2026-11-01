import { createBrowserClient } from "@supabase/ssr";

import { supabaseConfig } from "@/lib/env";

/**
 * Browser Supabase client.
 *
 * Only the publishable key is used here. The session lives in cookies managed
 * by `@supabase/ssr` — never in localStorage — so client and server agree on
 * the same identity.
 */
export function createClient() {
  return createBrowserClient(supabaseConfig.url, supabaseConfig.publishableKey);
}
