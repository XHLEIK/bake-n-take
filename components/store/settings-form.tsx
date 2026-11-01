"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Mail, MapPin, Phone } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { InlineMessage } from "@/components/auth/inline-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";
import { updateStoreSettingsAction } from "@/lib/store/actions";
import type { SocialLinks, StoreSettings, WeekHours } from "@/lib/store/types";
import type { AboutBannerKey } from "@/lib/store/types";

import { AboutEditor, toAboutDraft, type AboutFormDraft } from "./about-editor";

import { SettingsSwitch, SettingsTextArea } from "./fields";
import { HoursEditor } from "./hours-editor";
import { LogoUploader, type StagedImage } from "./logo-uploader";
import { SettingsGroup, SettingsSection } from "./settings-sections";
import { SocialsEditor, socialsToDraft, type SocialsDraft } from "./socials-editor";

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Pacific/Auckland",
  "UTC",
];

/**
 * Owner Store Settings console.
 *
 * One form, one explicit save: every section edits local state, and the save
 * action validates → uploads staged images → updates the singleton row →
 * revalidates the storefront. Nothing persists before save (logo picks and
 * removals are staged, never uploaded early), and navigating away with edits
 * warns via beforeunload.
 *
 * Field `name` attributes are the persistence contract with
 * `updateStoreSettingsAction` — reorganize freely, never rename them.
 */
export function SettingsForm({
  initial,
  logoUrl,
  faviconUrl,
  aboutBannerUrl,
  aboutDefaults,
}: {
  initial: StoreSettings;
  logoUrl: string | null;
  faviconUrl: string | null;
  aboutBannerUrl: string | null;
  aboutDefaults: { key: AboutBannerKey; label: string; url: string }[];
}) {
  const [state, formAction] = useActionState(updateStoreSettingsAction, INITIAL_AUTH_FORM_STATE);

  const [texts, setTexts] = useState(() => snapshotTexts(initial));
  const [isOpen, setIsOpen] = useState(initial.isOpen);
  const [acceptingOrders, setAcceptingOrders] = useState(initial.acceptingOrders);
  const [hours, setHours] = useState<WeekHours>(initial.hours);
  const [socials, setSocials] = useState<SocialsDraft>(() => socialsToDraft(initial.socials));
  const [logo, setLogo] = useState<StagedImage>({
    currentUrl: logoUrl,
    file: null,
    removed: false,
  });
  const [favicon, setFavicon] = useState<StagedImage>({
    currentUrl: faviconUrl,
    file: null,
    removed: false,
  });
  const [about, setAbout] = useState<AboutFormDraft>(() => toAboutDraft(initial.about));
  const [aboutImage, setAboutImage] = useState<StagedImage>({
    currentUrl: aboutBannerUrl,
    file: null,
    removed: false,
  });
  const [baseline] = useState(() =>
    JSON.stringify(snapshot(initial, logoUrl, faviconUrl, about, aboutBannerUrl)),
  );
  // Snapshot of the values as they stood at the last submit. Compared against
  // the pristine baseline to decide "unsaved changes" without syncing state
  // inside effects.
  const [submitted, setSubmitted] = useState<string | null>(null);

  function setText(key: keyof typeof texts) {
    return (value: string) => setTexts((previous) => ({ ...previous, [key]: value }));
  }

  const snapshotNow = useMemo(
    () =>
      JSON.stringify({
        texts,
        isOpen,
        acceptingOrders,
        hours,
        socials,
        logo: stageKey(logo),
        favicon: stageKey(favicon),
        about,
        aboutBanner: stageKey(aboutImage),
      }),
    [texts, isOpen, acceptingOrders, hours, socials, logo, favicon, about, aboutImage],
  );

  // A confirmed save quiets the bar only while the form still holds exactly
  // what was submitted; any further edit marks it dirty again.
  const dirty =
    state.status === "success" && submitted !== null && snapshotNow === submitted
      ? false
      : snapshotNow !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function resetAll() {
    setTexts(snapshotTexts(initial));
    setIsOpen(initial.isOpen);
    setAcceptingOrders(initial.acceptingOrders);
    setHours(initial.hours);
    setSocials(socialsToDraft(initial.socials));
    setLogo({ currentUrl: logoUrl, file: null, removed: false });
    setFavicon({ currentUrl: faviconUrl, file: null, removed: false });
    setAbout(toAboutDraft(initial.about));
    setAboutImage({ currentUrl: aboutBannerUrl, file: null, removed: false });
    setSubmitted(null);
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} onSubmit={() => setSubmitted(snapshotNow)} className="grid gap-8">
      {state.status === "error" && state.message ? (
        <InlineMessage variant="error" message={state.message} />
      ) : null}
      {state.status === "success" && state.message ? (
        <InlineMessage variant="success" message={state.message} />
      ) : null}

      <input type="hidden" name="hoursJson" value={JSON.stringify(hours)} />
      <input
        type="hidden"
        name="socialsJson"
        value={JSON.stringify({ ...socials, extra: socials.extra })}
      />
      <input type="hidden" name="aboutJson" value={JSON.stringify(about)} />

      <div className="grid min-w-0 gap-10">
        <SettingsSection
          id="general"
          title="General"
          description="The essentials — name, look and first impression."
        >
          <SettingsGroup
            title="Store identity"
            description="Name, tagline and description appear across the storefront, login, signup and metadata."
          >
            <FormField
              label="Store name"
              name="storeName"
              required
              maxLength={80}
              hint="Shown in the header with the tagline beneath it, and across the storefront."
              value={texts.storeName}
              onChange={(event) => setText("storeName")(event.currentTarget.value)}
              error={errors.storeName}
            />
            <FormField
              label="Tagline"
              name="tagline"
              maxLength={160}
              hint="The slogan under the shop name on the website."
              value={texts.tagline}
              onChange={(event) => setText("tagline")(event.currentTarget.value)}
              error={errors.tagline}
            />
            <SettingsTextArea
              label="Description"
              name="description"
              rows={3}
              maxLength={1000}
              value={texts.description}
              onChange={setText("description")}
              error={errors.description}
            />
          </SettingsGroup>

          <SettingsGroup
            title="Brand images"
            description="The logo replaces the default mark everywhere — header, login, signup, footer and browser tabs."
          >
            <LogoUploader
              name="logo"
              removedName="logoRemoved"
              label="Store logo"
              hint="Shown in the header, login, signup, footer and browser tabs."
              value={logo}
              onChange={setLogo}
            />
            <LogoUploader
              name="favicon"
              removedName="faviconRemoved"
              label="Favicon"
              hint="The small icon shown in browser tabs beside the page title."
              value={favicon}
              onChange={setFavicon}
            />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection
          id="contact"
          title="Contact & Location"
          description="How customers reach you and find the shop."
        >
          <SettingsGroup
            title="Contact information"
            description="Shown in the footer, contact sections and order communication."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Primary phone"
                name="phonePrimary"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                icon={<Phone className="size-4" />}
                value={texts.phonePrimary}
                onChange={(event) => setText("phonePrimary")(event.currentTarget.value)}
                error={errors.phonePrimary}
              />
              <FormField
                label="Secondary phone"
                name="phoneSecondary"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                icon={<Phone className="size-4" />}
                value={texts.phoneSecondary}
                onChange={(event) => setText("phoneSecondary")(event.currentTarget.value)}
                error={errors.phoneSecondary}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                icon={<Mail className="size-4" />}
                value={texts.email}
                onChange={(event) => setText("email")(event.currentTarget.value)}
                error={errors.email}
              />
              <FormField
                label="WhatsApp number"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                maxLength={20}
                hint="Digits with country code, e.g. 919876543210."
                value={texts.whatsapp}
                onChange={(event) => setText("whatsapp")(event.currentTarget.value)}
                error={errors.whatsapp}
              />
            </div>
          </SettingsGroup>

          <SettingsGroup
            title="Store address"
            description="Structured so the storefront can format it; shown in location sections and the footer."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Address line 1"
                name="addressLine1"
                autoComplete="address-line1"
                maxLength={120}
                icon={<MapPin className="size-4" />}
                value={texts.addressLine1}
                onChange={(event) => setText("addressLine1")(event.currentTarget.value)}
                error={errors.addressLine1}
              />
              <FormField
                label="Address line 2"
                name="addressLine2"
                autoComplete="address-line2"
                maxLength={120}
                value={texts.addressLine2}
                onChange={(event) => setText("addressLine2")(event.currentTarget.value)}
                error={errors.addressLine2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label="Locality / area"
                name="locality"
                maxLength={80}
                value={texts.locality}
                onChange={(event) => setText("locality")(event.currentTarget.value)}
                error={errors.locality}
              />
              <FormField
                label="City"
                name="city"
                autoComplete="address-level2"
                maxLength={80}
                value={texts.city}
                onChange={(event) => setText("city")(event.currentTarget.value)}
                error={errors.city}
              />
              <FormField
                label="State"
                name="state"
                autoComplete="address-level1"
                maxLength={80}
                value={texts.state}
                onChange={(event) => setText("state")(event.currentTarget.value)}
                error={errors.state}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="PIN code"
                name="postalCode"
                inputMode="text"
                autoComplete="postal-code"
                maxLength={12}
                value={texts.postalCode}
                onChange={(event) => setText("postalCode")(event.currentTarget.value)}
                error={errors.postalCode}
              />
              <FormField
                label="Country"
                name="country"
                autoComplete="country-name"
                required
                maxLength={60}
                value={texts.country}
                onChange={(event) => setText("country")(event.currentTarget.value)}
                error={errors.country}
              />
            </div>
            <details className="rounded-xl border border-border/70 px-4 py-3">
              <summary className="cursor-pointer rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Advanced map location
              </summary>
              <div className="grid gap-4 pt-4">
                <FormField
                  label="Google Maps URL"
                  name="mapsUrl"
                  type="url"
                  inputMode="url"
                  maxLength={500}
                  hint="Powers the directions link. Leave empty if unsure — the written address is what customers see most."
                  value={texts.mapsUrl}
                  onChange={(event) => setText("mapsUrl")(event.currentTarget.value)}
                  error={errors.mapsUrl}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Latitude"
                    name="latitude"
                    inputMode="decimal"
                    placeholder="e.g. 19.0760"
                    value={texts.latitude}
                    onChange={(event) => setText("latitude")(event.currentTarget.value)}
                    error={errors.latitude}
                  />
                  <FormField
                    label="Longitude"
                    name="longitude"
                    inputMode="decimal"
                    placeholder="e.g. 72.8777"
                    value={texts.longitude}
                    onChange={(event) => setText("longitude")(event.currentTarget.value)}
                    error={errors.longitude}
                  />
                </div>
              </div>
            </details>
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection
          id="operations"
          title="Operations"
          description="Hours, pickup and what customers see when plans change."
        >
          <SettingsGroup
            title="Business hours"
            description="Each day opens independently. Closed days are hidden on the storefront."
          >
            <HoursEditor value={hours} onChange={setHours} error={errors.hoursJson} />
          </SettingsGroup>

          <SettingsGroup
            title="Pickup information"
            description="Where and how customers collect their orders — shown on the storefront and at checkout."
          >
            <SettingsTextArea
              label="Pickup instructions"
              name="pickupInstructions"
              rows={3}
              maxLength={500}
              hint="Step-by-step for the customer: where to go and what to say on arrival."
              value={texts.pickupInstructions}
              onChange={setText("pickupInstructions")}
              error={errors.pickupInstructions}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Pickup location"
                name="pickupLocation"
                maxLength={200}
                hint="The counter or spot — e.g. shop counter, side gate."
                value={texts.pickupLocation}
                onChange={(event) => setText("pickupLocation")(event.currentTarget.value)}
                error={errors.pickupLocation}
              />
              <FormField
                label="Preparation time note"
                name="pickupEta"
                maxLength={120}
                placeholder="e.g. Ready in about 20 minutes"
                hint="Sets expectations wherever pickup times appear."
                value={texts.pickupEta}
                onChange={(event) => setText("pickupEta")(event.currentTarget.value)}
                error={errors.pickupEta}
              />
            </div>
            <SettingsTextArea
              label="Pickup notes"
              name="pickupNotes"
              rows={2}
              maxLength={500}
              hint="Anything else worth knowing before collecting."
              value={texts.pickupNotes}
              onChange={setText("pickupNotes")}
              error={errors.pickupNotes}
            />
          </SettingsGroup>

          <SettingsGroup
            title="Store status"
            description="Control whether your bakery is open and accepting orders."
          >
            <SettingsSwitch
              label="Store open"
              description="Off shows a “temporarily closed” banner on the storefront."
              name="isOpen"
              checked={isOpen}
              onChange={setIsOpen}
            />
            <SettingsSwitch
              label="Accepting orders"
              description="Off pauses checkout while the storefront stays visible."
              name="acceptingOrders"
              checked={acceptingOrders}
              onChange={setAcceptingOrders}
            />
            <FormField
              label="Status message"
              name="statusMessage"
              maxLength={200}
              placeholder="e.g. Orders paused today — back tomorrow at 10 AM."
              value={texts.statusMessage}
              onChange={(event) => setText("statusMessage")(event.currentTarget.value)}
              error={errors.statusMessage}
            />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection id="storefront" title="Storefront" description="What the homepage shows.">
          <SettingsGroup
            title="Storefront highlights"
            description="Limits how many slides rotate in the homepage hero carousel."
          >
            <FormField
              label="Maximum hero slides (1–10)"
              name="heroMaxSlides"
              inputMode="numeric"
              value={texts.heroMaxSlides}
              onChange={(event) => setText("heroMaxSlides")(event.currentTarget.value)}
              error={errors.heroMaxSlides}
            />
          </SettingsGroup>

          <SettingsGroup
            title="About Us"
            description="Homepage About section — shown after Featured when enabled. Edits apply on save."
          >
            <AboutEditor
              draft={about}
              onChange={setAbout}
              image={aboutImage}
              onImageChange={setAboutImage}
              defaults={aboutDefaults}
              error={errors.aboutJson}
            />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection id="social" title="Social" description="Where else customers follow you.">
          <SettingsGroup
            title="Social media"
            description="Only configured profiles appear on the storefront — empty fields stay hidden."
          >
            <SocialsEditor value={socials} onChange={setSocials} errors={errors} />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection
          id="regional"
          title="Regional"
          description="Applies everywhere prices and times are shown — change with care."
        >
          <SettingsGroup
            title="Regional settings"
            description="Currency formats every price on the storefront; timezone anchors scheduling."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label="Currency code"
                name="currency"
                required
                maxLength={3}
                placeholder="INR"
                value={texts.currency}
                onChange={(event) => setText("currency")(event.currentTarget.value.toUpperCase())}
                error={errors.currency}
              />
              <FormField
                label="Currency symbol"
                name="currencySymbol"
                required
                maxLength={4}
                placeholder="₹"
                value={texts.currencySymbol}
                onChange={(event) => setText("currencySymbol")(event.currentTarget.value)}
                error={errors.currencySymbol}
              />
              <FormField
                label="Timezone"
                name="timezone"
                required
                maxLength={60}
                list="common-timezones"
                placeholder="Asia/Kolkata"
                value={texts.timezone}
                onChange={(event) => setText("timezone")(event.currentTarget.value)}
                error={errors.timezone}
              />
            </div>
            <datalist id="common-timezones">
              {COMMON_TIMEZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </SettingsGroup>
        </SettingsSection>
      </div>

      {dirty ? (
        <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="px-1 text-xs font-medium">
            Unsaved changes
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={resetAll}
              className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reset changes
            </button>
            <div className="min-w-44 flex-1 sm:flex-none">
              <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
            </div>
          </div>
        </div>
      ) : (
        <p aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check aria-hidden="true" className="size-3.5 text-primary" />
          All changes saved
        </p>
      )}
    </form>
  );
}

type TextSnapshot = Record<string, string>;

function snapshotTexts(settings: StoreSettings): TextSnapshot {
  return {
    storeName: settings.storeName,
    tagline: settings.tagline,
    description: settings.description,
    phonePrimary: settings.phonePrimary ?? "",
    phoneSecondary: settings.phoneSecondary ?? "",
    email: settings.email ?? "",
    whatsapp: settings.whatsapp ?? "",
    addressLine1: settings.addressLine1 ?? "",
    addressLine2: settings.addressLine2 ?? "",
    locality: settings.locality ?? "",
    city: settings.city ?? "",
    state: settings.state ?? "",
    postalCode: settings.postalCode ?? "",
    country: settings.country,
    mapsUrl: settings.mapsUrl ?? "",
    latitude: settings.latitude === null ? "" : String(settings.latitude),
    longitude: settings.longitude === null ? "" : String(settings.longitude),
    pickupInstructions: settings.pickupInstructions ?? "",
    pickupLocation: settings.pickupLocation ?? "",
    pickupNotes: settings.pickupNotes ?? "",
    pickupEta: settings.pickupEta ?? "",
    statusMessage: settings.statusMessage,
    heroMaxSlides: String(settings.heroMaxSlides),
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    timezone: settings.timezone,
  };
}

function stageKey(image: StagedImage): string {
  if (image.file) return `file:${image.file.name}:${image.file.size}:${image.file.lastModified}`;
  return `url:${image.removed ? "removed" : (image.currentUrl ?? "none")}`;
}

function snapshot(
  settings: StoreSettings,
  logoUrl: string | null,
  faviconUrl: string | null,
  about: AboutFormDraft,
  aboutBannerUrl: string | null,
): Record<string, unknown> {
  return {
    texts: snapshotTexts(settings),
    isOpen: settings.isOpen,
    acceptingOrders: settings.acceptingOrders,
    hours: settings.hours,
    socials: socialsToDraft(settings.socials),
    logo: `url:${logoUrl ?? "none"}`,
    favicon: `url:${faviconUrl ?? "none"}`,
    about,
    aboutBanner: `url:${aboutBannerUrl ?? "none"}`,
  };
}

export type { SocialLinks };
