import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { LocaleProvider, useLocale } from '../LocaleContext';
import { getLocale, setLocale, t } from '@/i18n';

const mockLoad = jest.fn();
const mockStore = jest.fn(async (_preference: string) => undefined);
let mockLifecycleListener:
  | ((
      snapshot: { appState: string; isOnline: boolean },
      previous: { appState: string; isOnline: boolean },
    ) => void)
  | null = null;
let mockDeviceLocale: 'ja' | 'en' = 'en';

jest.mock('@/i18n/storage', () => ({
  loadStoredPreference: () => mockLoad(),
  storePreference: (value: string) => mockStore(value),
}));

// The catalogue and setLocale stay real so the assertions exercise the actual
// locale state; only the device lookup is steered.
jest.mock('@/i18n', () => ({
  ...jest.requireActual('@/i18n'),
  resolveDeviceLocale: () => mockDeviceLocale,
}));

jest.mock('@/lib/app-lifecycle', () => ({
  subscribeAppLifecycle: (listener: typeof mockLifecycleListener) => {
    mockLifecycleListener = listener;
    return () => {
      mockLifecycleListener = null;
    };
  },
}));

function Probe() {
  const { preference, locale, setPreference } = useLocale();
  probe = { preference, locale, setPreference };
  return <Text>{t('settings.signOut')}</Text>;
}

let probe: ReturnType<typeof useLocale> | null = null;

type Renderer = ReturnType<typeof TestRenderer.create>;

async function renderProvider(): Promise<Renderer> {
  let renderer: Renderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
  });
  return renderer!;
}

beforeEach(() => {
  probe = null;
  mockLifecycleListener = null;
  mockDeviceLocale = 'en';
  mockLoad.mockReset();
  mockStore.mockReset();
  mockStore.mockResolvedValue(undefined);
  setLocale('ja');
});

describe('LocaleProvider', () => {
  it('applies the stored choice instead of the device language', async () => {
    mockLoad.mockResolvedValue('ja');

    await renderProvider();

    expect(probe?.preference).toBe('ja');
    expect(probe?.locale).toBe('ja');
    expect(getLocale()).toBe('ja');
  });

  it('follows the device when nothing is stored', async () => {
    mockLoad.mockResolvedValue('system');

    await renderProvider();

    expect(probe?.preference).toBe('system');
    expect(probe?.locale).toBe('en');
  });

  it('renders nothing until the stored choice arrives', async () => {
    let resolveLoad: ((value: string) => void) | null = null;
    mockLoad.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    act(() => {
      TestRenderer.create(
        <LocaleProvider>
          <Probe />
        </LocaleProvider>,
      );
    });
    // Children must not render yet: showing the device language here would
    // flash the wrong one at someone who deliberately picked the other.
    expect(probe).toBeNull();

    await act(async () => {
      resolveLoad!('ja');
    });
    expect(probe?.locale).toBe('ja');
  });

  it('still starts when reading the stored choice fails', async () => {
    mockLoad.mockRejectedValue(new Error('storage unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await renderProvider();

    // The gate must lift even on failure, or the app renders nothing at all.
    expect(probe).not.toBeNull();
    expect(probe?.preference).toBe('system');
    warn.mockRestore();
  });

  it('saves the new choice and applies it immediately', async () => {
    mockLoad.mockResolvedValue('system');
    await renderProvider();

    await act(async () => {
      await probe!.setPreference('ja');
    });

    expect(probe?.locale).toBe('ja');
    expect(getLocale()).toBe('ja');
    expect(mockStore).toHaveBeenCalledWith('ja');
  });

  it('re-reads the device language on foreground while following the device', async () => {
    mockLoad.mockResolvedValue('system');
    await renderProvider();
    expect(probe?.locale).toBe('en');

    mockDeviceLocale = 'ja';
    await act(async () => {
      mockLifecycleListener?.(
        { appState: 'active', isOnline: true },
        { appState: 'background', isOnline: true },
      );
    });

    expect(probe?.locale).toBe('ja');
  });

  it('keeps an explicit choice when the device language changes', async () => {
    mockLoad.mockResolvedValue('ja');
    await renderProvider();

    mockDeviceLocale = 'en';
    await act(async () => {
      mockLifecycleListener?.(
        { appState: 'active', isOnline: true },
        { appState: 'background', isOnline: true },
      );
    });

    expect(probe?.locale).toBe('ja');
  });
});
