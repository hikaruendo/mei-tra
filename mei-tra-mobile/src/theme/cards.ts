/**
 * Card geometry, derived from the artwork rather than guessed.
 *
 * The card SVGs use `viewBox="0 0 210 315"` — exactly 2:3 — and round their
 * own corners with `rx="15"`. Deriving height and radius from width keeps every
 * card variant consistent with the art instead of drifting the way the previous
 * three hard-coded sizes did (they were 0.690 / 0.700 / 0.714, none of them 2:3).
 */
export const CARD_ASPECT = 3 / 2;
export const CARD_RADIUS_RATIO = 15 / 210;

export type CardSize = 'hand' | 'field' | 'seat';

export const CARD_BASE_WIDTHS: Record<CardSize, number> = {
  hand: 60,
  field: 44,
  seat: 30,
};

/**
 * Accessibility multiplier mirroring the web `--mt-card-scale`
 * (mei-tra-frontend/app/globals.scss). Wired through every card dimension so a
 * settings toggle can be added later without touching components.
 */
export const CARD_SCALES = {
  normal: 1,
  large: 1.1,
  xlarge: 1.2,
} as const;

export const cardHeight = (width: number): number => width * CARD_ASPECT;
export const cardRadius = (width: number): number =>
  Math.round(width * CARD_RADIUS_RATIO);
