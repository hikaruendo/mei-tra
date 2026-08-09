import type { FieldContract, TrumpType } from '@meitra/contracts/game';
import { validateCardPlay } from '@meitra/game-client/card-legality';

export const parseCard = (card: string) => {
  if (card === 'JOKER') {
    return { rank: 'JOKER', suit: '', isRed: false };
  }

  const suit = card.slice(-1);
  return {
    rank: card.slice(0, -1),
    suit,
    isRed: suit === '♥' || suit === '♦',
  };
};

export const isCardPlayable = (
  hand: string[],
  card: string,
  field: FieldContract | null,
  trump: TrumpType | null,
) => validateCardPlay(hand, card, field, trump).isValid;
