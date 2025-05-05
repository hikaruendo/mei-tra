import { useMemo } from 'react';
import { TrumpType, Field } from '../../../types/game.types';

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

const TRUMP_TO_SUIT: Record<TrumpType, string> = {
  tra: '', // traは特殊なので空文字
  herz: '♥', // ハート
  daiya: '♦', // ダイヤ
  club: '♣', // クラブ
  zuppe: '♠', // スペード
};

const getTrumpSuit = (trumpType: TrumpType): string => {
  return TRUMP_TO_SUIT[trumpType];
};

const isSecondaryJack = (card: string, trumpType: TrumpType): boolean => {
  return card === getSecondaryJack(trumpType);
}

const getPrimaryJack = (trumpType: TrumpType): string => {
  switch (trumpType) {
    case 'herz':
      return 'J♥';
    case 'daiya':
      return 'J♦';
    case 'club':
      return 'J♣';
    case 'zuppe':
      return 'J♠';
    case 'tra':
      return ''; // In Tra, no primary jack
    default:
      return 'J♥';
  }
}

const getSecondaryJack = (trumpType: TrumpType): string => {
  switch (trumpType) {
    case 'herz':
      return 'J♦';
    case 'daiya':
      return 'J♥';
    case 'club':
      return 'J♠';
    case 'zuppe':
      return 'J♣';
    case 'tra':
      return ''; // In Tra, no secondary jack
    default:
      return 'J♦';
  }
}

const getCardSuit = (
  card: string,
  trumpType?: TrumpType | null,
  baseSuit?: string,
): string => {
  if (card === 'JOKER') {
    return baseSuit || '';
  }

  // Handle 10 case
  if (card.startsWith('10')) {
    return card.slice(2);
  }

  // If it's a Jack and trumpType is provided, check if it's a secondary Jack
  if (card.startsWith('J') && trumpType) {
    if (isSecondaryJack(card, trumpType)) {
      // For secondary Jack, return the primary Jack's suit
      return getPrimaryJack(trumpType).replace(/[0-9JQKA]/, '');
    }
  }

  return card.slice(-1);
}

export const useCardValidation = (
  playerHand: string[],
  currentField: Field | null,
  currentTrump: TrumpType | null,
) => {
  return useMemo(() => {
    const isValidCardPlay = (card: string): ValidationResult => {
      // In Tanzen round, if player has Joker, they must play it
      if (playerHand.length === 2 && playerHand.includes('JOKER')) {
        if (card !== 'JOKER') {
          return {
            isValid: false,
            message: 'In Tanzen round, you must play the Joker if you have it.',
          };
        }
        return { isValid: true };
      }

      if (card === 'JOKER') {
        return { isValid: true };
      }

      // If no cards in field, any card is valid
      if (!currentField || currentField.cards.length === 0) {
        return { isValid: true };
      }

      const baseCard = currentField.baseCard;
      // If baseCard is Joker, use the selected baseSuit
      const baseSuit = baseCard === 'JOKER' ? currentField.baseSuit : getCardSuit(baseCard, currentTrump, currentField.baseSuit);
      const cardSuit = getCardSuit(card, currentTrump, baseSuit);

      // If no trump is set (Tra) or trump is not Tra, use normal suit matching rules
      if (!currentTrump || currentTrump === 'tra') {
        if (cardSuit === baseSuit) {
          return { isValid: true };
        }

        if (playerHand.some((c) => getCardSuit(c) === baseSuit)) {
          return {
            isValid: false,
            message: `You must play a card of suit ${baseSuit}`,
          };
        }
        return { isValid: true };
      }

      // Get the trump suit for the current trump type
      const trumpSuit = getTrumpSuit(currentTrump);

      // Normal suit matching rules
      if (baseCard) {
        // If player has the base suit, they must play it
        if (baseSuit !== cardSuit) {
          const hasBaseSuit = playerHand.some(
            (c) => getCardSuit(c, currentTrump) === baseSuit,
          );
          if (hasBaseSuit) {
            return {
              isValid: false,
              message: `You must play a card of suit ${baseSuit}.`,
            };
          }
        }

        // If currentTrump matches baseSuit, player has no cards of that suit, and has Joker, they must play Joker
        if (
          currentTrump === baseSuit &&
          playerHand.includes('JOKER') &&
          !playerHand.some(
            (c) => getCardSuit(c, currentTrump) === baseSuit,
          )
        ) {
          if (card !== 'JOKER') {
            return {
              isValid: false,
              message:
                'You must play the Joker since you have no cards of the trump suit.',
            };
          }
          return { isValid: true };
        }

        // If player has Joker and no trump cards, they must play Joker
        if (
          baseSuit === trumpSuit &&
          playerHand.includes('JOKER') &&
          !playerHand.some(
            (c) => getCardSuit(c, currentTrump) === trumpSuit,
          )
        ) {
          if (card !== 'JOKER') {
            return {
              isValid: false,
              message: `You must play the Joker since you have no ${trumpSuit} cards.`,
            };
          }
          return { isValid: true };
        }
      }

      return { isValid: true };
    };

    return {
      isValidCardPlay,
    };
  }, [playerHand, currentField, currentTrump]);
}; 