/**
 * Layer 1 — the raw palette, mirrored from the web app's `--mt-raw-*` tokens
 * (mei-tra-frontend/styles/base/variables.scss).
 *
 * These are theme-independent hex values. Components must never import from
 * here; consume `palette.ts` instead so a light theme can be added later by
 * swapping one file.
 */
export const raw = {
  felt900: '#0e2a21',
  felt800: '#12352a',
  felt700: '#173d30',
  felt600: '#1b4a3a',

  pale100: '#f4f0e3',
  pale200: '#e9e5d5',
  pale300: '#dad5c2',

  brass300: '#e0c784',
  brass500: '#c9a34e',
  brass600: '#a9863b',
  brass700: '#8a6c2e',

  ivory: '#ece6d6',
  sage: '#a9b7a6',

  ink900: '#23281f',
  ink600: '#4a5142',

  cardRed: '#c0362c',
  cardRedDark: '#9e2a22',
  cardRedLight: '#eda79d',
} as const;
