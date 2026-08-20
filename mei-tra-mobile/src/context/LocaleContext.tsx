import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getLocale,
  type LocalePreference,
  resolveDeviceLocale,
  resolvePreference,
  setLocale,
  type SupportedLocale,
} from '@/i18n';
import { loadStoredPreference, storePreference } from '@/i18n/storage';
import { subscribeAppLifecycle } from '@/lib/app-lifecycle';

interface LocaleContextValue {
  /** What was chosen, including 'system'. */
  preference: LocalePreference;
  /** What that resolves to right now. */
  locale: SupportedLocale;
  setPreference: (preference: LocalePreference) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<LocalePreference>('system');
  const [locale, setLocaleState] = useState<SupportedLocale>(getLocale());
  // Rendering before the stored choice arrives would flash the device language
  // at someone who deliberately picked the other one.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let active = true;

    void loadStoredPreference()
      .then((stored) => {
        if (!active) return;
        const resolved = resolvePreference(stored);
        setLocale(resolved);
        setPreferenceState(stored);
        setLocaleState(resolved);
      })
      .catch((error: unknown) => {
        console.warn('[Locale] Failed to restore the locale preference:', error);
      })
      // Always lift the gate: a failure here must not leave the app rendering
      // nothing. The device language is a usable fallback.
      .finally(() => {
        if (active) setRestored(true);
      });

    return () => {
      active = false;
    };
  }, []);

  // iOS restarts the app when the device language changes, but Android does
  // not, so in 'system' mode re-resolve whenever the app comes back to the
  // foreground. setState bails out when the language is unchanged.
  useEffect(() => {
    if (preference !== 'system') return;

    return subscribeAppLifecycle((snapshot, previous) => {
      if (snapshot.appState === 'active' && previous.appState !== 'active') {
        const resolved = resolveDeviceLocale();
        setLocale(resolved);
        setLocaleState(resolved);
      }
    });
  }, [preference]);

  const changePreference = useCallback(async (next: LocalePreference) => {
    const resolved = resolvePreference(next);
    setLocale(resolved);
    setPreferenceState(next);
    setLocaleState(resolved);
    await storePreference(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ preference, locale, setPreference: changePreference }),
    [changePreference, locale, preference],
  );

  if (!restored) {
    return null;
  }

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }

  return value;
}
