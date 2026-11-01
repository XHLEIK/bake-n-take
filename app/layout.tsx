import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { THEME_COOKIE, THEME_INIT_SCRIPT, parseTheme, serverThemeClass } from "@/lib/theme";
import { getStoreSettings, storeAssetUrl } from "@/lib/store/repository";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Editorial display serif for the brand moments (auth lockup, statement).
 * Self-hosted (woff2 in app/fonts) so the build never depends on a Google
 * Fonts fetch; scoped to those surfaces via `font-serif`.
 */
const cormorant = localFont({
  variable: "--font-cormorant",
  display: "swap",
  src: [
    { path: "./fonts/cormorant-garamond-regular.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-italic.woff2", weight: "500", style: "italic" },
  ],
});

const FALLBACK_METADATA: Metadata = {
  title: {
    default: "Bake n Take — fresh bakes, boxed to go",
    template: "%s · Bake n Take",
  },
  description:
    "Bake n Take is a neighbourhood bakery. Create an account to order fresh bakes, cakes and treats for takeaway.",
  applicationName: "Bake n Take",
  formatDetection: { telephone: false, address: false, email: false },
};

/**
 * Database-driven metadata: the owner-edited store name and description flow
 * into titles, Open Graph tags and the favicon, refreshed with the same
 * cache tag as the rest of the storefront. Static values above are the
 * first-paint fallback while settings load.
 *
 * The store logo is the single source of truth for the favicon: uploading or
 * replacing the logo updates the browser tab icon everywhere with no separate
 * favicon upload. Without a logo, a static brand mark is used so the default
 * framework icon never appears.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  if (!settings) return { ...FALLBACK_METADATA, icons: { icon: "/brand-icon.svg" } };
  const logo = storeAssetUrl(settings.logoPath);
  return {
    title: {
      default: `${settings.storeName} — ${settings.tagline || "fresh bakes, boxed to go"}`,
      template: `%s · ${settings.storeName}`,
    },
    description: settings.description || FALLBACK_METADATA.description,
    applicationName: settings.storeName,
    formatDetection: { telephone: false, address: false, email: false },
    openGraph: {
      title: settings.storeName,
      description: settings.description || undefined,
      siteName: settings.storeName,
    },
    icons: { icon: logo ?? "/brand-icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfaf5" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1713" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);

  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  // Inline scripts need the per-request nonce from the CSP applied in proxy.ts.
  const nonce = headerList.get("x-nonce") ?? undefined;
  const htmlClassName = [
    geistSans.variable,
    geistMono.variable,
    cormorant.variable,
    "h-full",
    serverThemeClass(theme),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="en" className={htmlClassName} suppressHydrationWarning>
      <head>
        {/* Resolves "system" before the first paint so the theme never flashes. */}
        <Script
          id="theme-init"
          nonce={nonce}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="brand-canvas flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
