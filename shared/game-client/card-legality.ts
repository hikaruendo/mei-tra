import type { FieldContract, TrumpType } from '@meitra/contracts/game';

export type CardField = Pick<FieldContract, 'cards' | 'baseCard' | 'baseSuit'>;

export interface CardValidationResult {
  isValid: boolean;
  message?: string;
}

const TRUMP_TO_SUIT: Record<TrumpType, string> = {
  tra: '',
  herz: '♥',
  daiya: '♦',
  club: '♣',
  zuppe: '♠',
};

const getSecondaryJack = (trump: TrumpType): string => {
  switch (trump) {
    case 'herz':
      return 'J♦';
    case 'daiya':
      return 'J♥';
    case 'club':
      return 'J♠';
    case 'zuppe':
      return 'J♣';
    case 'tra':
      return '';
  }
};

const getCardSuit = (
  card: string,
  trump: TrumpType | null,
  baseSuit?: string,
): string => {
  if (card === 'JOKER') {
    return baseSuit ?? '';
  }

  if (trump && card === getSecondaryJack(trump)) {
    return TRUMP_TO_SUIT[trump];
  }

  return card.slice(-1);
};

export const validateCardPlay = (
  hand: string[],
  card: string,
  field: CardField | null,
  trump: TrumpType | null,
): CardValidationResult => {
  if (hand.length === 2 && hand.includes('JOKER')) {
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

  if (!field || field.cards.length === 0) {
    return { isValid: true };
  }

  const baseSuit =
    field.baseCard === 'JOKER'
      ? field.baseSuit
      : getCardSuit(field.baseCard, trump, field.baseSuit);
  const cardSuit = getCardSuit(card, trump, baseSuit);

  if (!trump || trump === 'tra') {
    if (cardSuit === baseSuit) {
      return { isValid: true };
    }

    if (
      hand.some(
        (candidate) =>
          candidate !== 'JOKER' && getCardSuit(candidate, null) === baseSuit,
      )
    ) {
      return {
        isValid: false,
        message: `You must play a card of suit ${baseSuit}`,
      };
    }

    return { isValid: true };
  }

  const trumpSuit = TRUMP_TO_SUIT[trump];

  if (field.baseCard) {
    if (baseSuit !== cardSuit) {
      const hasBaseSuit = hand.some(
        (candidate) =>
          candidate !== 'JOKER' &&
          getCardSuit(candidate, trump, baseSuit) === baseSuit,
      );

      if (hasBaseSuit) {
        return {
          isValid: false,
          message: `You must play a card of suit ${baseSuit}.`,
        };
      }
    }

    if (
      trumpSuit === baseSuit &&
      hand.includes('JOKER') &&
      !hand.some(
        (candidate) =>
          candidate !== 'JOKER' &&
          getCardSuit(candidate, trump, baseSuit) === baseSuit,
      )
    ) {
      if (card !== 'JOKER') {
        return {
          isValid: false,
          message: 'You must play the Joker since you have no cards of the trump suit.',
        };
      }

      return { isValid: true };
    }
  }

  return { isValid: true };
};
