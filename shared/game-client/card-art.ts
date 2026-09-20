import type { CardDesign } from '@meitra/contracts/profile';

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

export const CARD_DESIGNS = ['standard', 'densho'] as const satisfies readonly CardDesign[];

export function normalizeCardDesign(value: unknown): CardDesign {
  return value === 'densho' ? 'densho' : 'standard';
}

/** Original scans remain intact; these viewports exclude print marks/bleed. */
export const DENSHO_ART = {
  card_back: { width: 1149, height: 1576, viewBox: '175 175 799 1227' },
  joker_red: { width: 799, height: 1228, viewBox: '0 0 799 1228' },
  A_S: { width: 1149, height: 1576, viewBox: '184 184 785 1211' },
} as const;

export type DenshoArtId = keyof typeof DENSHO_ART;

/** Only supplied faces are replaced. All other ranks retain their own art. */
export function resolveDenshoArtId(
  card: string,
  faceDown: boolean,
  design: CardDesign,
): DenshoArtId | null {
  if (design !== 'densho') return null;
  const id = faceDown ? CARD_BACK_ID : cardToSvgId(card);
  return Object.prototype.hasOwnProperty.call(DENSHO_ART, id)
    ? id as DenshoArtId
    : null;
}
