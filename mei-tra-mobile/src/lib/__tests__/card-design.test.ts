import { DENSHO_STYLED_SOURCES } from '../densho-card-assets';
import { CARD_ART_IDS, denshoImageSize, normalizeCardDesign, resolveDenshoArtId, resolveDenshoStyledArtId } from '@meitra/game-client/card-art';

it('defaults old and unknown profile values to standard', () => {
  for (const value of [undefined, null, 'unknown', 'standard']) {
    expect(normalizeCardDesign(value)).toBe('standard');
  }
  expect(normalizeCardDesign('densho')).toBe('densho');
});

it('overrides only supplied card art and always conceals face-down cards', () => {
  expect(resolveDenshoArtId('A♠', false, 'densho')).toBe('A_S');
  expect(resolveDenshoArtId('JOKER', false, 'densho')).toBe('joker_red');
  expect(resolveDenshoArtId('A♠', true, 'densho')).toBe('card_back');
  expect(resolveDenshoArtId('JOKER', true, 'densho')).toBe('card_back');
  expect(resolveDenshoArtId('K♥', false, 'densho')).toBeNull();
  expect(resolveDenshoArtId('A♠', false, 'standard')).toBeNull();
});

it('ships a matching face for every non-original card without exposing face-down art', () => {
  const expected = [...CARD_ART_IDS];
  expect(Object.keys(DENSHO_STYLED_SOURCES).sort()).toEqual(expected.sort());
  expect(resolveDenshoStyledArtId('Q♥', false, 'densho')).toBe('Q_H');
  expect(resolveDenshoStyledArtId('Q♥', true, 'densho')).toBeNull();
  expect(resolveDenshoStyledArtId('Q♥', false, 'standard')).toBeNull();
  expect(resolveDenshoStyledArtId('A♠', false, 'densho')).toBeNull();
  expect(resolveDenshoStyledArtId('JOKER', false, 'densho')).toBeNull();
  expect(resolveDenshoStyledArtId('unknown', false, 'densho')).toBeNull();
});

it('selects thumbnails using physical pixels, preserving resolution on dense screens', () => {
  expect(denshoImageSize(30 * 3)).toBe('small');
  expect(denshoImageSize(60 * 3)).toBe('medium');
  expect(denshoImageSize(80 * 3)).toBe('large');
  for (const sources of Object.values(DENSHO_STYLED_SOURCES)) {
    expect(Object.keys(sources).sort()).toEqual(['large', 'medium', 'small']);
  }
});
