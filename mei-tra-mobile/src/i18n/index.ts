import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';

import en from './en.json';
import ja from './ja.json';

export const SUPPORTED_LOCALES = ['ja', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: SupportedLocale = 'ja';

const i18n = new I18n({ ja, en });
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;
// Use the web app's `{name}` placeholders instead of i18n-js's `{{name}}`, so
// copy can be moved between mei-tra-frontend/messages and this catalogue.
i18n.placeholder = /\{(\w+)\}/g;

/** Picks the first device language we actually ship, else Japanese. */
export function resolveDeviceLocale(): SupportedLocale {
  for (const { languageCode } of getLocales()) {
    const match = SUPPORTED_LOCALES.find((locale) => locale === languageCode);
    if (match) {
      return match;
    }
  }

  return DEFAULT_LOCALE;
}

i18n.locale = resolveDeviceLocale();

export function setLocale(locale: SupportedLocale): void {
  i18n.locale = locale;
}

export function getLocale(): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(i18n.locale)
    ? (i18n.locale as SupportedLocale)
    : DEFAULT_LOCALE;
}

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
