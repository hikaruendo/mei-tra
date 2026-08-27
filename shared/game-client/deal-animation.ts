export type DealEvent =
  | 'game-started'
  | 'new-round-started'
  | 'broken'
  | 'round-cancelled';

export interface DealAnimationCue {
  token: number;
  startedAt: number;
  seatIds: readonly string[];
}

export const DEAL_CARD_STAGGER_MS = 45;
export const DEAL_CARD_DURATION_MS = 180;
export const DEAL_CARD_TRANSLATE_X = -24;
export const DEAL_CARD_INITIAL_SCALE = 0.96;

export const dealAnimationDurationMs = (cardCount: number): number =>
  cardCount <= 0
    ? 0
    : (cardCount - 1) * DEAL_CARD_STAGGER_MS + DEAL_CARD_DURATION_MS;

export const dealAnimationRemainingMs = (
  cue: DealAnimationCue,
  cardCount: number,
  now: number,
): number =>
  Math.max(0, cue.startedAt + dealAnimationDurationMs(cardCount) - now);

export interface DealCardAnimationTiming {
  delayMs: number;
  durationMs: number;
  initialProgress: number;
}

export const dealCardAnimationTiming = (
  cue: DealAnimationCue,
  cardIndex: number,
  now: number,
): DealCardAnimationTiming => {
  const cardStartedAt = cue.startedAt + cardIndex * DEAL_CARD_STAGGER_MS;
  const elapsedMs = Math.max(0, now - cardStartedAt);

  return {
    delayMs: Math.max(0, cardStartedAt - now),
    durationMs: Math.max(0, DEAL_CARD_DURATION_MS - elapsedMs),
    initialProgress: Math.min(
      1,
      Math.max(0, elapsedMs / DEAL_CARD_DURATION_MS),
    ),
  };
};
