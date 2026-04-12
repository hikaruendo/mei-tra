import {
  DEFAULT_FONT_SIZE_PRESET,
  DEFAULT_THEME_PREFERENCE,
  FONT_SIZE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  normalizeUserPreferences,
  readStoredFontSizePreset,
  readStoredThemePreference,
} from '@/lib/preferences';

describe('preferences helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes missing fontSize to standard', () => {
    expect(
      normalizeUserPreferences({
        notifications: false,
        sound: true,
        theme: 'light',
      }),
    ).toEqual({
      notifications: false,
      sound: true,
      theme: 'light',
      fontSize: 'standard',
    });
  });

  it('reads stored theme and font size when values are valid', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, 'xxlarge');

    expect(readStoredThemePreference()).toBe('system');
    expect(readStoredFontSizePreset()).toBe('xxlarge');
  });

  it('falls back to defaults when stored values are invalid', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, 'massive');

    expect(readStoredThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
    expect(readStoredFontSizePreset()).toBe(DEFAULT_FONT_SIZE_PRESET);
  });
});
