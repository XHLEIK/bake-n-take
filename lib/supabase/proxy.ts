import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { supabaseConfig } from "@/lib/env";

export type SessionRefreshResult = {
  /** Response that already carries any refreshed session cookies. */
  response: NextResponse;
  /** Verified user, or null when there is no valid session. */
  user: User | null;
};

/**
 * Refreshes the Supabase session for an incoming request.
 *
 * Runs inside `proxy.ts` (Next.js 16's renamed middleware). Two rules apply:
 *  1. Nothing may run between creating the client and `getUser()`, otherwise
 *     the refreshed cookies can be dropped.
 *  2. This is an *optimistic* check only — it decides redirects for humans, not
 *     authorization. Every protected page and action re-verifies server-side.
 *
 * `requestHeaders` carries per-request additions (nonce + CSP) so that every
 * response Next.js produces — including rewrites — keeps them.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<SessionRefreshResult> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not add logic between these two statements: it can invalidate the
  // refreshed session cookies that Supabase just wrote.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
