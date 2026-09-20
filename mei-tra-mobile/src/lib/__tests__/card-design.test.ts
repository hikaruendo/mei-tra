import { normalizeCardDesign, resolveDenshoArtId } from '@meitra/game-client/card-art';

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
