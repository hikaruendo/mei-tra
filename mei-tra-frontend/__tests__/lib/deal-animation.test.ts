import {
  DEAL_CARD_DURATION_MS,
  DEAL_CARD_STAGGER_MS,
  dealCardAnimationTiming,
  dealAnimationDurationMs,
  dealAnimationRemainingMs,
  type DealAnimationCue,
} from '@meitra/game-client/deal-animation';
import { soundEffectForGameEvent } from '@meitra/game-client/sound-effects';

describe('deal animation timing', () => {
  const cue: DealAnimationCue = {
    token: 1,
    startedAt: 1_000,
    seatIds: ['seat-1'],
  };

  it('stagger cards by 45ms and lets each card travel for 180ms', () => {
    expect(DEAL_CARD_STAGGER_MS).toBe(45);
    expect(DEAL_CARD_DURATION_MS).toBe(180);
    expect(dealAnimationDurationMs(12)).toBe(675);
    expect(dealAnimationRemainingMs(cue, 12, 1_300)).toBe(375);
    expect(dealAnimationRemainingMs(cue, 12, 2_000)).toBe(0);
    expect(dealCardAnimationTiming(cue, 2, 1_000)).toEqual({
      delayMs: 90,
      durationMs: 180,
      initialProgress: 0,
    });
    expect(dealCardAnimationTiming(cue, 2, 1_180)).toEqual({
      delayMs: 0,
      durationMs: 90,
      initialProgress: 0.5,
    });
    expect(dealCardAnimationTiming(cue, 2, 1_500)).toEqual({
      delayMs: 0,
      durationMs: 0,
      initialProgress: 1,
    });
  });

  it.each([
    'game-started',
    'new-round-started',
    'broken',
    'round-cancelled',
  ] as const)('maps %s to one shuffle sound', (event) => {
    expect(soundEffectForGameEvent(event)).toBe('shuffle');
  });
});
