import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import en from './en.json';
import ja from './ja.json';

export const SUPPORTED_LOCALES = ['ja', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** What the person chose. 'system' defers to the device. */
export type LocalePreference = SupportedLocale | 'system';

const DEFAULT_LOCALE: SupportedLocale = 'ja';

const i18n = new I18n({ ja, en });
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;
// Use the web app's `{name}` placeholders instead of i18n-js's `{{name}}`, so
// copy can be moved between mei-tra-frontend/messages and this catalogue.
i18n.placeholder = /\{(\w+)\}/g;

function isSupported(value: string | null | undefined): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '');
}

/** Picks the first device language we actually ship, else Japanese. */
export function resolveDeviceLocale(): SupportedLocale {
  for (const { languageCode } of getLocales()) {
    if (isSupported(languageCode)) {
      return languageCode;
    }
  }

  return DEFAULT_LOCALE;
}

export function resolvePreference(
  preference: LocalePreference,
): SupportedLocale {
  return preference === 'system' ? resolveDeviceLocale() : preference;
}

export function setLocale(locale: SupportedLocale): void {
  i18n.locale = locale;
  activeTag = deviceTagFor(locale);
}

export function getLocale(): SupportedLocale {
  return isSupported(i18n.locale) ? i18n.locale : DEFAULT_LOCALE;
}

const FALLBACK_TAGS: Record<SupportedLocale, string> = {
  ja: 'ja-JP',
  en: 'en-US',
};

/**
 * Prefers the device's own regional variant of the chosen language, so an
 * en-GB phone gets British date order rather than the US default.
 */
function deviceTagFor(locale: SupportedLocale): string {
  try {
    const match = getLocales().find(
      (entry) => entry.languageCode === locale && entry.languageTag,
    );
    return match?.languageTag ?? FALLBACK_TAGS[locale];
  } catch {
    return FALLBACK_TAGS[locale];
  }
}

let activeTag: string = FALLBACK_TAGS[DEFAULT_LOCALE];

/** BCP 47 tag for Intl / toLocale* APIs, so dates follow the app language. */
export function getLocaleTag(): string {
  return activeTag;
}

setLocale(resolveDeviceLocale());

/**
 * Translate a key. Kept as a bare function rather than a hook so non-React
 * modules (socket handlers, api clients) can use the same catalogue.
 */
export function t(
  key: string,
  options?: Record<string, string | number>,
): string {
  return i18n.t(key, options);
}

export default i18n;
