import AsyncStorage from '@react-native-async-storage/async-storage';

import { SUPPORTED_LOCALES, type LocalePreference } from '.';

const PREFERENCE_KEY = 'meitra.locale';

function isPreference(value: string | null): value is LocalePreference {
  return (
    value === 'system' ||
    (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '')
  );
}

/**
 * Reads the saved choice. Storage failures fall back to following the device
 * rather than blocking startup on a preference nobody has set yet.
 */
export async function loadStoredPreference(): Promise<LocalePreference> {
  try {
    const stored = await AsyncStorage.getItem(PREFERENCE_KEY);
    if (isPreference(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn('[i18n] Failed to read the locale preference:', error);
  }

  return 'system';
}

export async function storePreference(
  preference: LocalePreference,
): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERENCE_KEY, preference);
  } catch (error) {
    console.warn('[i18n] Failed to save the locale preference:', error);
  }
}
