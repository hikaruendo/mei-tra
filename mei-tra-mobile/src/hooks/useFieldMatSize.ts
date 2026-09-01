import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { CARD_ASPECT, CARD_BASE_WIDTHS } from '@/theme/cards';

/**
 * Sizes the zabuton under the trick.
 *
 * This was a flat `FIELD_MAT_SIZE = 164`, which had two problems. One constant
 * cannot serve an SE and a Pro Max — the SE has no room to spare and the Pro
 * Max was left with a postage stamp in the middle of the table. And it was
 * larger than the box it was centred in (`fieldCenter`, then 180x150), so the
 * cushion hung 7pt past its parent top and bottom and only drew at all because
 * RN views do not clip by default.
 *
 * The artwork is rendered from a three.js scene rather than drawn flat, so it
 * has visible thickness: the cushion's *top face* — the part the cards can
 * actually rest on — is FACE_HEIGHT of the image, not all of it. That fraction
 * is measured at render time and recorded in
 * `mei-tra-frontend/scripts/table-art/manifest.json`; keep the two in step.
 */

/** Fraction of the image the top face spans vertically. See manifest.json `framing.faceHeight`. */
export const FACE_HEIGHT = 0.82;

/** The played cards make a cross this tall: one card, plus the up/down offset either side. */
const CROSS_HEIGHT = CARD_BASE_WIDTHS.field * CARD_ASPECT + 24 * 2;

/**
 * Bounds on the mat, as multiples of the cross it has to contain.
 *
 * The floor is what an SE can give without pushing the hand below the fold —
 * measured, not guessed: the play-phase scroll column there comes to ~620pt
 * against a ~595pt viewport, leaving the hand ~15pt clear. The ceiling stops
 * larger phones from turning the trick into four stamps on a pillow.
 */
const MIN_SIZE = Math.round((CROSS_HEIGHT * 1.37) / FACE_HEIGHT);
const MAX_SIZE = Math.round((CROSS_HEIGHT * 1.54) / FACE_HEIGHT);

/** Between those bounds the mat tracks the screen. */
const HEIGHT_FRACTION = 0.26;

/** `scrollContent` padding either side, plus `field`'s own. */
const CHROME_WIDTH = 48;

const clamp = (min: number, max: number, value: number) =>
  Math.min(max, Math.max(min, value));

/** Pure geometry, split out so it can be tested without a renderer. */
export function computeFieldMatSize(width: number, height: number): number {
  return Math.min(
    clamp(MIN_SIZE, MAX_SIZE, Math.round(height * HEIGHT_FRACTION)),
    Math.round(width - CHROME_WIDTH),
  );
}

export function useFieldMatSize(): number {
  const { width, height } = useWindowDimensions();
  return useMemo(() => computeFieldMatSize(width, height), [width, height]);
}
