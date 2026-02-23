import type { TrumpType } from '../../types/game.types';

const TRUMP_DISPLAY: Record<TrumpType, string> = {
  tra: 'Tra',
  herz: '♥',
  daiya: '♦',
  club: '♣',
  zuppe: '♠',
};

export function getTrumpDisplay(trumpType: TrumpType | null): string {
  if (!trumpType) return '';
  return TRUMP_DISPLAY[trumpType];
}

export function getPrimaryJack(trumpType: TrumpType): string {
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
      return '';
    default:
      return 'J♥';
  }
}

export function getSecondaryJack(trumpType: TrumpType): string {
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
      return '';
    default:
      return 'J♦';
  }
}

export interface StrengthOrderItem {
  type: 'joker' | 'mainJack' | 'subJack' | 'otherTrump' | 'otherCards' | 'generic';
  label?: string;
  suitKey?: TrumpType;
}

const CARD_ORDER_WITHOUT_J = ['A', 'K', 'Q', '10', '9', '8', '7', '6', '5'];

/**
 * Returns the card strength order for display, based on current trump.
 * Uses same logic as backend CardService (getPrimaryJack, getSecondaryJack).
 * Labels are keys/params for i18n - component should translate.
 */
export function getStrengthOrder(trumpType: TrumpType | null): StrengthOrderItem[] {
  if (!trumpType) {
    return [
      { type: 'generic', label: 'JOKER > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5' },
    ];
  }

  if (trumpType === 'tra') {
    return [
      {
        type: 'generic',
        label: 'JOKER > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5',
        suitKey: 'tra',
      },
    ];
  }

  const mainJ = getPrimaryJack(trumpType);
  const subJ = getSecondaryJack(trumpType);

  return [
    { type: 'joker', label: 'JOKER' },
    { type: 'mainJack', label: mainJ },
    { type: 'subJack', label: subJ },
    {
      type: 'otherTrump',
      label: CARD_ORDER_WITHOUT_J.join(' > '),
      suitKey: trumpType,
    },
    { type: 'otherCards' },
  ];
}
