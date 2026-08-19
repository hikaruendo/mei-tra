import ja from '../ja.json';
import en from '../en.json';
import { getLocale, setLocale, SUPPORTED_LOCALES, t } from '..';

type Catalogue = Record<string, unknown>;

function flatten(value: Catalogue, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') {
      Object.assign(out, flatten(child as Catalogue, path));
    } else {
      out[path] = String(child);
    }
  }
  return out;
}

const flatJa = flatten(ja as Catalogue);
const flatEn = flatten(en as Catalogue);
const placeholders = (value: string) =>
  new Set(Array.from(value.matchAll(/\{(\w+)\}/g), (m) => m[1]));

describe('i18n catalogues', () => {
  it('ships the same keys in every locale', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatJa).sort());
  });

  it('keeps placeholders identical across locales', () => {
    const mismatched = Object.keys(flatJa).filter(
      (key) =>
        [...placeholders(flatJa[key])].sort().join() !==
        [...placeholders(flatEn[key])].sort().join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('has no blank copy', () => {
    const blank = Object.keys(flatJa).filter(
      (key) => !flatJa[key].trim() || !flatEn[key].trim(),
    );
    expect(blank).toEqual([]);
  });
});

describe('t()', () => {
  afterEach(() => setLocale('ja'));

  it('renders each locale from the same key', () => {
    setLocale('ja');
    expect(t('settings.signOut')).toBe('ログアウト');
    setLocale('en');
    expect(t('settings.signOut')).toBe('Log out');
  });

  it('interpolates the web-style {name} placeholder', () => {
    setLocale('ja');
    expect(t('rooms.greeting', { name: 'ゲスト1' })).toBe(
      'ゲスト1さん、対局を始めましょう',
    );
    setLocale('en');
    expect(t('rooms.greeting', { name: 'Guest 1' })).toBe(
      'Ready for a game, Guest 1?',
    );
  });

  it('resolves every shipped key in both locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      setLocale(locale);
      for (const key of Object.keys(flatJa)) {
        // Supply every placeholder the copy declares, so a legitimately
        // parameterised string is not reported as missing.
        const options = Object.fromEntries(
          [...placeholders(flatJa[key])].map((name) => [name, 'x']),
        );
        const rendered = t(key, options);
        expect(rendered).not.toMatch(/^\[missing/);
        expect(rendered).not.toBe(key);
      }
    }
  });

  it('only reports locales it can actually serve', () => {
    for (const locale of SUPPORTED_LOCALES) {
      setLocale(locale);
      expect(getLocale()).toBe(locale);
    }
  });
});
