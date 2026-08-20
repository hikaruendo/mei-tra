import type { TrumpType } from '@meitra/contracts/game';
import { t } from '@/i18n';

function getPrimaryJack(trumpType: TrumpType): string {
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
  }
}

function getSecondaryJack(trumpType: TrumpType): string {
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
  }
}

const CARD_ORDER_WITHOUT_J = ['A', 'K', 'Q', '10', '9', '8', '7', '6', '5'];

export function getStrengthOrderLabel(trumpType: TrumpType | null): string {
  if (!trumpType || trumpType === 'tra') {
    return 'JOKER > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5';
  }
  const mainJ = getPrimaryJack(trumpType);
  const subJ = getSecondaryJack(trumpType);
  return `JOKER > ${mainJ} > ${subJ} > ${CARD_ORDER_WITHOUT_J.join(' > ')} > ${t('game.otherSuits')}`;
}
