import { FontSizePreset, UserPreferences } from '@/types/user.types';

export const THEME_STORAGE_KEY = 'theme';
export const FONT_SIZE_STORAGE_KEY = 'fontSize';

export const DEFAULT_THEME_PREFERENCE: UserPreferences['theme'] = 'dark';
export const DEFAULT_FONT_SIZE_PRESET: FontSizePreset = 'standard';

export const FONT_SIZE_PRESETS: Record<
  FontSizePreset,
  {
    scale: number;
    rootPercent: number;
  }
> = {
  standard: {
    scale: 1,
    rootPercent: 100,
  },
  large: {
    scale: 1.2,
    rootPercent: 120,
  },
  xlarge: {
    scale: 1.5,
    rootPercent: 150,
  },
  // Legacy value kept so old persisted preferences do not break.
  xxlarge: {
    scale: 1.5,
    rootPercent: 150,
  },
};

export const FONT_SIZE_PRESET_ORDER: FontSizePreset[] = [
  'standard',
  'large',
  'xlarge',
];

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: true,
  sound: true,
  theme: DEFAULT_THEME_PREFERENCE,
  fontSize: DEFAULT_FONT_SIZE_PRESET,
};

export function isThemePreference(value: unknown): value is UserPreferences['theme'] {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isFontSizePreset(value: unknown): value is FontSizePreset {
  return value === 'standard' || value === 'large' || value === 'xlarge' || value === 'xxlarge';
}

export function normalizeFontSizePreset(value: unknown): FontSizePreset {
  if (value === 'xxlarge') {
    return 'xlarge';
  }

  return isFontSizePreset(value) ? value : DEFAULT_FONT_SIZE_PRESET;
}

export function normalizeUserPreferences(
  preferences?: Partial<UserPreferences> | null,
): UserPreferences {
  return {
    notifications:
      typeof preferences?.notifications === 'boolean'
        ? preferences.notifications
        : DEFAULT_USER_PREFERENCES.notifications,
    sound:
      typeof preferences?.sound === 'boolean'
        ? preferences.sound
        : DEFAULT_USER_PREFERENCES.sound,
    theme: isThemePreference(preferences?.theme)
      ? preferences.theme
      : DEFAULT_USER_PREFERENCES.theme,
    fontSize: normalizeFontSizePreset(preferences?.fontSize),
  };
}

export function readStoredThemePreference(): UserPreferences['theme'] {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_PREFERENCE;
  }

  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedTheme) ? storedTheme : DEFAULT_THEME_PREFERENCE;
}

export function readStoredFontSizePreset(): FontSizePreset {
  if (typeof window === 'undefined') {
    return DEFAULT_FONT_SIZE_PRESET;
  }

  const storedFontSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
  return normalizeFontSizePreset(storedFontSize);
}
