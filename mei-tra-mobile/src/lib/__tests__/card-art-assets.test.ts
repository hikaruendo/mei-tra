import {
  CARD_ART_IDS,
  CARD_BACK_ID,
  cardToSvgId,
  isCourtArtId,
} from '@meitra/game-client/card-art';

import { CARD_ART_KEYS, resolveCardArt } from '../card-art-assets';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = [
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

describe('cardToSvgId', () => {
  it('maps a suited card to {rank}_{suit}', () => {
    expect(cardToSvgId('A♠')).toBe('A_S');
    expect(cardToSvgId('10♥')).toBe('10_H');
    expect(cardToSvgId('K♦')).toBe('K_D');
  });

  it('maps JOKER to the red joker and junk to the back', () => {
    expect(cardToSvgId('JOKER')).toBe('joker_red');
    expect(cardToSvgId('')).toBe(CARD_BACK_ID);
    expect(cardToSvgId('???')).toBe(CARD_BACK_ID);
  });
});

describe('card art registry', () => {
  it('has an asset for every id the mapping can produce', () => {
    const known = new Set([...CARD_ART_KEYS.vector, ...CARD_ART_KEYS.raster]);
    const missing = CARD_ART_IDS.filter((id) => !known.has(id));
    expect(missing).toEqual([]);
  });

  it('rasterises exactly the twelve court cards', () => {
    expect(CARD_ART_KEYS.raster).toHaveLength(12);
    expect(CARD_ART_KEYS.raster.every(isCourtArtId)).toBe(true);
    expect(CARD_ART_KEYS.vector.some(isCourtArtId)).toBe(false);
  });

  it('resolves every card in the deck, plus the joker and the back', () => {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const art = resolveCardArt(`${rank}${suit}`);
        expect(art.kind).toBe(isCourtArtId(`${rank}_S`) ? 'raster' : 'vector');
        if (art.kind === 'vector') expect(art.Svg).toBeTruthy();
        else expect(art.source).toBeTruthy();
      }
    }

    expect(resolveCardArt('JOKER').kind).toBe('vector');
    expect(resolveCardArt('A♠', true).kind).toBe('vector');
  });

  it('falls back to the card back rather than throwing on junk input', () => {
    const art = resolveCardArt('not-a-card');
    expect(art.kind).toBe('vector');
  });
});
