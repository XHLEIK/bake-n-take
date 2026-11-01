import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Hostnames allowed for next/image optimization, parsed from the public
 * Supabase URL at build time (plus the standard platform hosts as fallback so
 * local/preview builds without env configured still compile).
 */
function supabaseStorageHosts(): string[] {
  const hosts = new Set(["*.supabase.co"]);
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (raw) {
    try {
      hosts.add(new URL(raw).hostname);
    } catch {
      // Invalid URL: fall back to the platform wildcard.
    }
  }
  return [...hosts];
}

/**
 * Security headers that are identical for every request.
 *
 * The Content-Security-Policy is intentionally *not* here: it carries a fresh
 * per-request nonce, so it is applied in `proxy.ts`. See `docs/SECURITY.md` for
 * the rationale behind each header.
 */
const securityHeaders = [
  // Never let a browser guess a content type (blocks polyglot upload tricks).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Belt and braces with the CSP `frame-ancestors` directive.
  { key: "X-Frame-Options", value: "DENY" },
  // Send the origin, but not the path, to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The bakery app needs none of these APIs today.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Keep popups (OAuth hand-offs) isolated from the app window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Only advertised over HTTPS; `preload` is deliberately omitted because it
  // commits the whole domain and is a client decision.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Do not advertise the framework version.
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Owner-uploaded brand assets served from Supabase Storage. The host is
    // derived from configuration so no project URL is hardcoded; only the
    // store-assets path prefix is ever loaded through next/image.
    remotePatterns: supabaseStorageHosts().map((hostname) => ({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/public/store-assets/**",
    })),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
