import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseConfig } from "@/lib/env";

/**
 * Server Supabase client for Server Components, Server Actions and Route
 * Handlers. Cookies are the transport for the session; writes are only
 * permitted in Server Actions and Route Handlers.
 *
 * This file must not be imported from client components — it has no
 * `server-only` marker so tests can import it under Node, but it depends on
 * `next/headers`, which guarantees a server-only runtime.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Thrown when called during a Server Component render pass, where
          // cookies are read-only. Session refresh is the responsibility of
          // `proxy.ts`, so ignoring this case is safe.
        }
      },
    },
  });
}

/**
 * Service-role client for trusted server-side admin work.
 *
 * Bypasses RLS, so the blast radius is the whole database: only call it from
 * Server Actions / Route Handlers, only for the single admin operation needed
 * there, and never import it (or the key) into client components. The key must
 * stay out of `NEXT_PUBLIC_*` variables and out of git — see `.env.example`.
 *
 * Currently used for one thing: confirming a just-registered signup email so
 * registration completes even if "Confirm email" was left enabled in the
 * Supabase dashboard. The dashboard toggle remains the primary switch; this
 * is the safety net.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error(
      'Missing "SUPABASE_SERVICE_ROLE_KEY". Add it to .env.local (see .env.example).',
    );
  }
  return createSupabaseClient(supabaseConfig.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
