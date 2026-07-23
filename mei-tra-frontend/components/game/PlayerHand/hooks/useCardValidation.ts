import { useMemo } from 'react';
import { TrumpType, Field } from '@/types/game.types';

import { validateCardPlay } from '../../../../../shared/game-client/card-legality';

export const useCardValidation = (
  playerHand: string[],
  currentField: Field | null,
  currentTrump: TrumpType | null,
) => {
  return useMemo(
    () => ({
      isValidCardPlay: (card: string) =>
        validateCardPlay(playerHand, card, currentField, currentTrump),
    }),
    [playerHand, currentField, currentTrump],
  );
};
