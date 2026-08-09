/**
 * Maps a wire card string to the id of its artwork.
 *
 * Shared so web and mobile cannot drift: web turns the id into a
 * `/cards/{id}.svg` URL, mobile keys a static require map from it.
 */
const SUIT_MAP: Record<string, string> = {
  '♠': 'S',
  '♥': 'H',
  '♦': 'D',
  '♣': 'C',
};

export const CARD_BACK_ID = 'card_back';
export const JOKER_ID = 'joker_red';

export const CARD_RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const;

export const CARD_SUIT_CODES = ['S', 'H', 'D', 'C'] as const;

/** Ranks whose artwork ships as a raster rather than a vector. */
export const COURT_RANKS = ['J', 'Q', 'K'] as const;

/** Every artwork id that `cardToSvgId` can return. */
export const CARD_ART_IDS: string[] = [
  ...CARD_RANKS.flatMap((rank) =>
    CARD_SUIT_CODES.map((suit) => `${rank}_${suit}`),
  ),
  CARD_BACK_ID,
  JOKER_ID,
];

export function cardToSvgId(card: string): string {
  if (card === 'JOKER') return JOKER_ID;

  const suit = card.match(/[♠♣♥♦]/)?.[0];
  const rank = card.replace(/[♠♣♥♦]/, '');

  if (!suit || !rank) return CARD_BACK_ID;
  return `${rank}_${SUIT_MAP[suit]}`;
}

export function isCourtArtId(id: string): boolean {
  return (COURT_RANKS as readonly string[]).includes(id.split('_')[0]);
}
