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

/**
 * How much of a card the next one covers in an overlapped row, matching the web
 * app's face-down stack (margin-left -0.7rem on a 1.55rem card).
 */
export const CARD_STACK_OVERLAP = 0.45;

export const cardHeight = (width: number): number => width * CARD_ASPECT;

/**
 * The artwork rounds its own corners at 15/210, but at seat sizes (~30pt) that
 * is barely 2px and reads as a sharp rectangle. Web compensates the same way —
 * its face-down card uses a 0.25rem radius on a 1.55rem card — so enforce a
 * floor that keeps small cards looking like cards.
 */
export const cardRadius = (width: number): number =>
  Math.max(4, Math.round(width * CARD_RADIUS_RATIO));

/** Negative margin that overlaps stacked cards by CARD_STACK_OVERLAP. */
export const cardStackMargin = (width: number): number =>
  -Math.round(width * CARD_STACK_OVERLAP);
