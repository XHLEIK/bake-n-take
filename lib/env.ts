/**
 * Public runtime configuration.
 *
 * Next.js inlines `NEXT_PUBLIC_*` variables at build time, so these values are
 * safe to read from both the server and the browser. Only the Supabase
 * *publishable* key belongs here — service-role credentials must never be
 * referenced from application code (see `docs/SECURITY.md`).
 */

function readPublicEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env.local and fill it in (see docs/SUPABASE-SETUP.md).`,
    );
  }
  return trimmed;
}

const supabaseUrl = readPublicEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

const supabasePublishableKey = readPublicEnv(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/** Canonical origin used for auth redirect URLs, without a trailing slash. */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

/**
 * Builds an absolute URL for Supabase redirect targets.
 * `origin` comes from the incoming request, which keeps preview deployments
 * and local development working without extra configuration.
 */
export function authRedirectUrl(path: string, origin: string): string {
  return `${siteUrl || origin.replace(/\/+$/, "")}${path}`;
}

export const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
} as const;
