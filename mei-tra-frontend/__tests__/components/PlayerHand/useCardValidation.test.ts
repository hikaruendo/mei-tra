import { renderHook } from '@testing-library/react';
import { asSeatId } from '@contracts/ids';
import type { Field } from '@/types/game.types';
import { useCardValidation } from '@/components/game/PlayerHand/hooks/useCardValidation';

const field = (baseCard: string, baseSuit?: string): Field => ({
  cards: [baseCard],
  playedBySeatIds: [asSeatId('player-1')],
  baseCard,
  ...(baseSuit ? { baseSuit } : {}),
  dealerSeatId: asSeatId('player-1'),
  isComplete: false,
});

describe('useCardValidation', () => {
  it('preserves the follow-suit message and validity', () => {
    const { result } = renderHook(() =>
      useCardValidation(['5♠', 'A♥'], field('9♠'), 'tra'),
    );

    expect(result.current.isValidCardPlay('A♥')).toEqual({
      isValid: false,
      message: 'You must play a card of suit ♠',
    });
    expect(result.current.isValidCardPlay('5♠')).toEqual({ isValid: true });
  });

  it('treats the secondary jack as trump only when a suit trump is active', () => {
    const { result } = renderHook(() =>
      useCardValidation(['J♦', 'A♠'], field('9♥'), 'herz'),
    );

    expect(result.current.isValidCardPlay('A♠')).toEqual({
      isValid: false,
      message: 'You must play a card of suit ♥.',
    });
    expect(result.current.isValidCardPlay('J♦')).toEqual({ isValid: true });
  });

  it('keeps the Joker requirement when trump is led', () => {
    const { result } = renderHook(() =>
      useCardValidation(['JOKER', 'A♠', 'K♣'], field('9♥'), 'herz'),
    );

    expect(result.current.isValidCardPlay('A♠')).toEqual({
      isValid: false,
      message: 'You must play the Joker since you have no cards of the trump suit.',
    });
    expect(result.current.isValidCardPlay('JOKER')).toEqual({ isValid: true });
  });
});
