import Link from "next/link";
import { Clock, Mail, MapPin, MessageCircle, PackageCheck, PauseCircle, Phone } from "lucide-react";

import { formatAddress } from "@/lib/store/repository";
import { WEEK_DAYS, dayKeyFor, hasAnyHours, type StoreSettings } from "@/lib/store/types";

/**
 * Customer storefront info sections.
 *
 * Every block renders from store settings and hides gracefully when its data
 * is missing: no address → no card, closed day → "Closed". A null settings
 * row renders nothing, so the page never depends on decorative data.
 * Presentation: calm editorial cards with a hairline top rule and a warm icon.
 */

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-3 rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-4">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

export function StoreHero({ settings }: { settings: StoreSettings | null }) {
  return (
    <div className="grid gap-3">
      <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
        {settings ? "Fresh from the oven" : "Welcome"}
      </p>
      <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {settings?.storeName ?? "Our bakery"}
      </h1>
      {settings?.tagline ? (
        <p className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
          {settings.tagline}
        </p>
      ) : null}
      {settings?.description ? (
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          {settings.description}
        </p>
      ) : null}
    </div>
  );
}

export function StoreStatusBanner({ settings }: { settings: StoreSettings | null }) {
  if (!settings || (settings.isOpen && settings.acceptingOrders)) return null;

  const closed = !settings.isOpen;
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm"
    >
      {closed ? (
        <PauseCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : (
        <PackageCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      )}
      <div className="grid gap-0.5">
        <p className="font-medium">
          {closed ? "Temporarily closed" : "Ordering is paused right now"}
        </p>
        {settings.statusMessage ? (
          <p className="text-muted-foreground">{settings.statusMessage}</p>
        ) : null}
      </div>
    </div>
  );
}

export function VisitSection({ settings }: { settings: StoreSettings | null }) {
  if (!settings) return null;
  const address = formatAddress(settings);
  const showHours = hasAnyHours(settings.hours);
  if (!address && !showHours && !settings.mapsUrl) return null;

  const today = dayKeyFor(new Date());

  return (
    <InfoCard icon={<MapPin aria-hidden="true" />} title="Visit the bakery">
      {address ? <p className="text-sm leading-relaxed">{address}</p> : null}
      {showHours ? (
        <ul className="grid gap-1.5 text-sm">
          {WEEK_DAYS.map((day) => {
            const row = settings.hours[day];
            return (
              <li key={day} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground capitalize">
                  {day}
                  {day === today ? " ·" : ""}
                </span>
                <span className={`tabular-nums ${day === today ? "font-medium" : undefined}`}>
                  {row.open ? `${row.opens_at}–${row.closes_at}` : "Closed"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {settings.mapsUrl ? (
        <Link
          href={settings.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Get directions
        </Link>
      ) : null}
    </InfoCard>
  );
}

export function ContactSection({ settings }: { settings: StoreSettings | null }) {
  if (!settings) return null;
  const phones = [settings.phonePrimary, settings.phoneSecondary].filter(
    (phone): phone is string => !!phone,
  );
  if (phones.length === 0 && !settings.email && !settings.whatsapp) return null;

  return (
    <InfoCard icon={<Phone aria-hidden="true" />} title="Talk to us">
      <div className="grid gap-2 text-sm">
        {phones.map((phone) => (
          <p key={phone} className="flex items-center gap-2.5">
            <Phone aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
              {phone}
            </a>
          </p>
        ))}
        {settings.email ? (
          <p className="flex items-center gap-2.5">
            <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <a href={`mailto:${settings.email}`} className="break-all hover:underline">
              {settings.email}
            </a>
          </p>
        ) : null}
        {settings.whatsapp ? (
          <p className="flex items-center gap-2.5">
            <MessageCircle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
              className="hover:underline"
            >
              Chat on WhatsApp
            </a>
          </p>
        ) : null}
      </div>
    </InfoCard>
  );
}

export function PickupSection({ settings }: { settings: StoreSettings | null }) {
  if (!settings) return null;
  const rows = [
    settings.pickupInstructions,
    settings.pickupLocation,
    settings.pickupNotes,
    settings.pickupEta,
  ].filter((text): text is string => !!text);
  if (rows.length === 0) return null;

  return (
    <InfoCard icon={<Clock aria-hidden="true" />} title="Pickup">
      <div className="grid gap-2 text-sm text-muted-foreground">
        {rows.map((text) => (
          <p key={text} className="leading-relaxed">
            {text}
          </p>
        ))}
      </div>
    </InfoCard>
  );
}
