const SUIT_MAP: Record<string, string> = {
  '♠': 'S',
  '♥': 'H',
  '♦': 'D',
  '♣': 'C',
};

export function cardToSvgId(card: string): string {
  if (card === 'JOKER') return 'joker_red';

  const suit = card.match(/[♠♣♥♦]/)?.[0];
  const rank = card.replace(/[♠♣♥♦]/, '');

  if (!suit || !rank) return 'card_back';
  return `${rank}_${SUIT_MAP[suit]}`;
}

export function cardToSvgPath(card: string): string {
  const id = cardToSvgId(card);
  return `/cards/${id}.svg`;
}

export const CARD_BACK_PATH = '/cards/card_back.svg';
