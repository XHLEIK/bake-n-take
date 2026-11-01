import Link from "next/link";
import { AtSign, Camera, Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { formatAddress, getStoreSettings } from "@/lib/store/repository";
import { isActive } from "@/lib/auth/roles";
import { getSessionContext } from "@/lib/auth/session";
import { listCategories } from "@/lib/catalog/repository";
import type { SocialLinks } from "@/lib/store/types";

import { BrandMark } from "@/components/brand/brand-mark";

/** Lucide dropped brand glyphs; labels carry the platform meaning instead. */
const SOCIAL_ICONS = { instagram: Camera, facebook: AtSign, whatsapp: MessageCircle } as const;

type KnownSocial = keyof typeof SOCIAL_ICONS;

const KNOWN_PLATFORMS = ["instagram", "facebook", "whatsapp"] as const;

/**
 * Database-driven site footer.
 *
 * The strongest branded surface on the page: brand column (logo, name,
 * owner line, description, socials), quick links, live shop categories,
 * and contact details. Every section renders only when its settings exist —
 * no address → no address block, no social URL → a gracefully disabled
 * icon that preserves the row structure without linking anywhere fake.
 * Nothing may fall back to hardcoded business information.
 *
 * The band itself is the final destination surface — warm taupe in
 * light, deep card tone in dark — with text and structure unchanged for
 * both themes.
 */
export async function SiteFooter() {
  const [settings, session, categories] = await Promise.all([
    getStoreSettings(),
    getSessionContext(),
    listCategories(),
  ]);
  const webstore =
    session && isActive(session.profile) && session.profile.role === "CUSTOMER"
      ? `/webstore/${session.user.id}`
      : null;

  const address = settings ? formatAddress(settings) : null;
  const phones = settings
    ? [settings.phonePrimary, settings.phoneSecondary].filter((phone): phone is string => !!phone)
    : [];
  const email = settings?.email ?? null;
  const socials = settings ? visibleSocials(settings.socials) : [];
  const description = settings?.description?.trim() ? settings.description : null;

  const quickLinks = [
    { label: "Home", href: webstore ?? "/" },
    { href: webstore ? `${webstore}/shop` : "/login", label: "Bake list" },
    ...(webstore
      ? [
          { href: `${webstore}#about`, label: "About" },
          { href: `${webstore}#contact`, label: "Contact" },
          { href: `${webstore}/orders`, label: "My orders" },
        ]
      : []),
  ];

  return (
    <footer
      id="contact"
      className="surface-footer mt-auto scroll-mt-20 border-t border-border/60 px-5 pt-14 pb-8 sm:px-8"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="grid content-start gap-4">
          <Link
            href="/"
            aria-label={settings ? `${settings.storeName} home` : "Store home"}
            className="w-fit"
          >
            <BrandMark settings={settings} slogan size="lg" />
          </Link>
          {description ? (
            <p className="max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground line-clamp-4">
              {description}
            </p>
          ) : settings?.tagline ? (
            <p className="max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground">
              {settings.tagline}
            </p>
          ) : null}
          <ul className="flex items-center gap-2" aria-label="Social media">
            {KNOWN_PLATFORMS.map((key) => {
              const configured = socials.find((entry) => entry.key === key);
              const Icon = SOCIAL_ICONS[key as KnownSocial] ?? Globe;
              const label = key[0].toUpperCase() + key.slice(1);
              if (!configured) {
                return (
                  <li key={key}>
                    <span
                      aria-disabled="true"
                      title={`${label} not configured yet`}
                      aria-label={`${label} (not configured)`}
                      className="grid size-10 place-items-center rounded-xl border border-border/40 bg-card/40 text-muted-foreground/40"
                    >
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                  </li>
                );
              }
              return (
                <li key={key}>
                  <a
                    href={configured.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid size-10 place-items-center rounded-xl border border-border/70 bg-card/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </a>
                </li>
              );
            })}
            {socials
              .filter(({ key }) => !(KNOWN_PLATFORMS as readonly string[]).includes(key))
              .map(({ key, label, url }) => (
                <li key={`${key}-${url}`}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid size-10 place-items-center rounded-xl border border-border/70 bg-card/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Globe aria-hidden="true" className="size-4" />
                  </a>
                </li>
              ))}
          </ul>
        </div>

        <nav aria-label="Quick links" className="grid content-start gap-3">
          <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Explore
          </h2>
          <ul className="grid gap-2.5 text-sm">
            {quickLinks.map((link) => (
              <li key={link.href + link.label}>
                <Link
                  href={link.href}
                  className="text-foreground/90 hover:text-primary hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Shop categories" className="grid content-start gap-3">
          <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Shop
          </h2>
          {categories.length > 0 ? (
            <ul className="grid gap-2.5 text-sm">
              {categories.slice(0, 6).map((category) => (
                <li key={category.id}>
                  {webstore ? (
                    <Link
                      href={`${webstore}/shop?category=${category.slug}`}
                      className="text-foreground/90 hover:text-primary hover:underline"
                    >
                      {category.name}
                    </Link>
                  ) : (
                    <span className="text-foreground/90">{category.name}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Categories coming soon.</p>
          )}
        </nav>

        <nav aria-label="Contact" className="grid content-start gap-3">
          <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Contact us
          </h2>
          {address || phones.length > 0 || email ? (
            <ul className="grid gap-2.5 text-sm">
              {address ? (
                <li className="flex items-start gap-2.5">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="leading-relaxed">
                    {address}
                    {settings?.mapsUrl ? (
                      <>
                        {" "}
                        <a
                          href={settings.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Get directions
                        </a>
                      </>
                    ) : null}
                  </span>
                </li>
              ) : null}
              {phones.map((phone) => (
                <li key={phone} className="flex items-center gap-2.5">
                  <Phone aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                    {phone}
                  </a>
                </li>
              ))}
              {email ? (
                <li className="flex items-center gap-2.5">
                  <Mail aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <a href={`mailto:${email}`} className="break-all hover:underline">
                    {email}
                  </a>
                </li>
              ) : null}
              {settings?.whatsapp ? (
                <li className="flex items-center gap-2.5">
                  <MessageCircle aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Chat on WhatsApp
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Contact details coming soon.</p>
          )}
        </nav>
      </div>

      <div className="mx-auto mt-12 flex w-full max-w-7xl flex-col items-start justify-between gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <p>
          © {new Date().getFullYear()}
          {settings?.storeName ? ` ${settings.storeName}` : ""}. Baked with patience.
        </p>
        <Link href="/owner/login" className="font-medium underline-offset-4 hover:underline">
          Bakery owner sign-in
        </Link>
      </div>
    </footer>
  );
}

/** Known platforms first, then owner extras. Unconfigured URLs never render as links. */
export function visibleSocials(
  socials: SocialLinks,
): { key: string; label: string; url: string }[] {
  const rows: { key: string; label: string; url: string }[] = [];
  for (const key of ["instagram", "facebook", "whatsapp"] as const) {
    const url = socials[key];
    if (url) rows.push({ key, label: key[0].toUpperCase() + key.slice(1), url });
  }
  for (const entry of socials.extra ?? []) {
    if (entry.url) rows.push({ key: `extra-${entry.label}`, label: entry.label, url: entry.url });
  }
  return rows;
}
