import type { BlowDeclaration } from '@/types/game.types';

import {
  getValidBlowPairValues,
  isBlowDeclarationValid,
} from '@meitra/game-client/blow';

const declaration = (
  overrides: Partial<BlowDeclaration> = {},
): BlowDeclaration => ({
  seatId: 'player-1',
  trumpType: 'zuppe',
  numberOfPairs: 6,
  timestamp: 1,
  ...overrides,
});

describe('BlowControls affordance rules', () => {
  it('matches the current first-declaration candidates', () => {
    expect(getValidBlowPairValues(null, null)).toEqual([6, 7, 8, 9, 10]);
  });

  it('matches the current tie and next-pair ordering', () => {
    const highest = declaration({ trumpType: 'herz', numberOfPairs: 7 });

    expect(isBlowDeclarationValid('daiya', 7, highest)).toBe(false);
    expect(isBlowDeclarationValid('tra', 7, highest)).toBe(true);
    expect(getValidBlowPairValues(highest, 'tra')).toEqual([7, 8, 9, 10]);
    expect(
      getValidBlowPairValues(declaration({ numberOfPairs: 10 }), null),
    ).toEqual([11]);
  });
});
