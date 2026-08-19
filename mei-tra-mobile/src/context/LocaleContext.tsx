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
  resolvePreference,
  setLocale,
  type SupportedLocale,
} from '@/i18n';
import { loadStoredPreference, storePreference } from '@/i18n/storage';

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

    void loadStoredPreference().then((stored) => {
      if (!active) return;
      const resolved = resolvePreference(stored);
      setLocale(resolved);
      setPreferenceState(stored);
      setLocaleState(resolved);
      setRestored(true);
    });

    return () => {
      active = false;
    };
  }, []);

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
