import type { Metadata } from "next";
import Link from "next/link";

import { InlineMessage } from "@/components/auth/inline-message";
import { SettingsForm } from "@/components/store/settings-form";
import { SettingsNav } from "@/components/store/settings-sections";
import { requireOwner } from "@/lib/auth/session";
import { getStoreSettings, storeAssetUrl } from "@/lib/store/repository";
import { ABOUT_BANNERS } from "@/lib/store/types";

export const metadata: Metadata = { title: "Store settings" };

/**
 * Owner Store Settings console (Phase 2).
 *
 * Static route, so it wins over `/owner/[uid]`. `requireOwner` enforces the
 * OWNER role server-side; customers and visitors never reach the form. When
 * settings cannot load, the page shows an explicit error with a retry — never
 * a form bound to invented values.
 */
export default async function StoreSettingsPage() {
  await requireOwner("/owner/settings");

  const settings = await getStoreSettings();

  return (
    <>
      <SettingsNav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8 lg:py-14">
        <h1 className="sr-only">Store settings</h1>

        {settings ? (
          <SettingsForm
            initial={settings}
            logoUrl={storeAssetUrl(settings.logoPath)}
            faviconUrl={storeAssetUrl(settings.faviconPath)}
            aboutBannerUrl={storeAssetUrl(settings.about.bannerPath)}
            aboutDefaults={ABOUT_BANNERS.map((entry) => ({
              ...entry,
              url: storeAssetUrl(entry.path) ?? "",
            }))}
          />
        ) : (
          <div className="grid gap-4">
            <InlineMessage
              variant="error"
              message="We could not load the store settings. Check your connection and try again."
            />
            <Link
              href="/owner/settings"
              className="text-sm font-medium text-primary hover:underline"
            >
              Retry
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
