import { useMemo } from 'react';

import { CARD_BASE_WIDTHS } from '@/theme/cards';

/**
 * Sizes the player's hand so it fits the screen.
 *
 * The web app advances each card by a fixed 62.5% of its width (80px card,
 * -15px overlap). Applied verbatim on a 375pt phone that needs ~525pt for a
 * ten-card hand, so cards ran off both edges.
 *
 * Instead of shrinking the cards until they are unreadable, this compresses the
 * *exposure* — how much of each card the next one leaves visible. The rank
 * index sits in the top-left ~21% of the artwork (the SVGs put it at x≈11-45 of
 * 210), so cards stay identifiable down to roughly a quarter exposed. Width is
 * only reduced once exposure has bottomed out.
 */
const MIN_WIDTH = 44;
const MAX_WIDTH = CARD_BASE_WIDTHS.hand;
/** Web's ratio: (80 - 15) / 80. */
const MAX_EXPOSE = 0.625;
/** Below this the rank index starts to be covered. */
const MIN_EXPOSE = 0.26;
/** Slack for the ±15° rotation widening the row's bounding box. */
const ROTATION_SLACK = 0.94;

const clamp = (min: number, max: number, value: number) =>
  Math.min(max, Math.max(min, value));

export interface HandFanMetrics {
  /** Width to render each card at. */
  cardWidth: number;
  /** marginHorizontal for each card, negative to overlap. */
  cardMargin: number;
}

/** Pure geometry, split out so it can be tested without a renderer. */
export function computeHandFanMetrics(
  availableWidth: number,
  cardCount: number,
  scale = 1,
): HandFanMetrics {
  const usable = Math.max(0, availableWidth) * ROTATION_SLACK;

  if (cardCount <= 1 || usable <= 0) {
    return { cardWidth: MAX_WIDTH * scale, cardMargin: 0 };
  }

  // Try the largest card first, then compress exposure to make it fit.
  let cardWidth = MAX_WIDTH * scale;
  let expose = (usable / cardWidth - 1) / (cardCount - 1);

  if (expose < MIN_EXPOSE) {
    // Exposure has bottomed out; shrink the card instead.
    cardWidth = clamp(
      MIN_WIDTH * scale,
      MAX_WIDTH * scale,
      usable / (1 + (cardCount - 1) * MIN_EXPOSE),
    );
    expose = MIN_EXPOSE;
  }

  expose = clamp(MIN_EXPOSE, MAX_EXPOSE, expose);

  return {
    cardWidth,
    // RN applies marginHorizontal to both sides, so halve the overlap.
    cardMargin: -(cardWidth * (1 - expose)) / 2,
  };
}

export function useHandFanMetrics(
  availableWidth: number,
  cardCount: number,
  scale = 1,
): HandFanMetrics {
  return useMemo(
    () => computeHandFanMetrics(availableWidth, cardCount, scale),
    [availableWidth, cardCount, scale],
  );
}
