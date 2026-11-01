import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath, loginPathFor, pathWithParams } from "@/lib/auth/paths";
import { supabaseConfig } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy (the file convention formerly known as `middleware.ts`).
 *
 * Responsibilities, in order:
 *  1. refresh the Supabase session cookie for every request,
 *  2. attach a per-request nonce and Content-Security-Policy,
 *  3. perform *optimistic* redirects for unauthenticated visitors.
 *
 * It deliberately does not decide authorization: role checks live in the
 * server-side Data Access Layer and in Postgres RLS, so a proxy mistake can
 * never hand out access.
 */

function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function supabaseOrigins(): { https: string; wss: string } {
  const { origin } = new URL(supabaseConfig.url);
  return { https: origin, wss: origin.replace(/^http/, "ws") };
}

/**
 * Content-Security-Policy.
 *
 * Scripts are nonce + `strict-dynamic` based: Next.js reads the nonce from the
 * request CSP header and stamps it onto the scripts it renders, so no inline
 * script can execute without it. `style-src` keeps `'unsafe-inline'` because
 * Next.js and Tailwind emit inline style attributes (a nonce in `style-src`
 * would disable `'unsafe-inline'` and break rendering); CSS cannot exfiltrate
 * the session on its own and `script-src` remains strict.
 *
 * `upgrade-insecure-requests` and `'unsafe-eval'` follow the environment:
 * `'unsafe-eval'` is only needed by React's development tooling.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const supabase = supabaseOrigins();

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase.https}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase.https} ${supabase.wss}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? "" : "upgrade-insecure-requests",
  ];

  return directives.filter(Boolean).join("; ");
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  // Next.js reads the CSP + nonce from the request headers and applies the
  // nonce to the scripts it renders.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const { response, user } = await updateSession(request, requestHeaders);

  const { pathname, search } = request.nextUrl;
  const needsSession = isProtectedPath(pathname);

  let finalResponse = response;
  if (!user && needsSession) {
    const target = pathWithParams(loginPathFor(pathname), { next: `${pathname}${search}` });
    finalResponse = NextResponse.redirect(new URL(target, request.url));
    // Keep whatever Supabase wrote (for example, clearing a stale cookie).
    for (const cookie of response.cookies.getAll()) {
      finalResponse.cookies.set(cookie);
    }
  }

  finalResponse.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return finalResponse;
}

export const config = {
  /**
   * Everything except Next.js internals and static assets. Auth logic must not
   * run for those, and running it there would block CSS/JS/images.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
