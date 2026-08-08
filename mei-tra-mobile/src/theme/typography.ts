/**
 * Type scale mirroring the web `$font-size-*` tokens (rem at a 16px root),
 * rounded to whole points.
 */
export const typography = {
  size: {
    xs: 11,
    sm: 14,
    base: 16,
    lg: 22,
    xl: 32,
    xxl: 35,
  },
  weight: {
    regular: '400',
    medium: '500',
    bold: '700',
    heavy: '900',
  },
} as const;
