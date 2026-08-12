import type { BlowDeclarationContract } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';

import {
  getValidBlowPairValues,
  getTrumpStrength,
  isBlowDeclarationValid,
} from '@meitra/game-client/blow';

const declaration = (
  overrides: Partial<BlowDeclarationContract> = {},
): BlowDeclarationContract => ({
  seatId: asSeatId('player-1'),
  trumpType: 'zuppe',
  numberOfPairs: 6,
  timestamp: 1,
  ...overrides,
});

describe('blow client affordances', () => {
  it('keeps the trump strength ordering', () => {
    expect(getTrumpStrength('zuppe')).toBeLessThan(getTrumpStrength('tra'));
  });

  it('allows the Web-compatible first declaration range', () => {
    expect(isBlowDeclarationValid('tra', 10, null)).toBe(true);
    expect(isBlowDeclarationValid('tra', 11, null)).toBe(false);
  });

  it('uses trump strength to break ties', () => {
    const highest = declaration({ trumpType: 'herz', numberOfPairs: 7 });

    expect(isBlowDeclarationValid('daiya', 7, highest)).toBe(false);
    expect(isBlowDeclarationValid('tra', 7, highest)).toBe(true);
    expect(isBlowDeclarationValid('zuppe', 8, highest)).toBe(true);
  });

  it('offers only the next pair after ten or more', () => {
    expect(getValidBlowPairValues(declaration({ numberOfPairs: 10 }), null)).toEqual([
      11,
    ]);
    expect(getValidBlowPairValues(declaration({ numberOfPairs: 13 }), 'tra')).toEqual(
      [],
    );
  });

  it('keeps the default candidate range at six through ten', () => {
    expect(getValidBlowPairValues(null, null)).toEqual([
      6, 7, 8, 9, 10,
    ]);
    expect(
      getValidBlowPairValues(declaration({ numberOfPairs: 6 }), 'herz'),
    ).toEqual([6, 7, 8, 9, 10]);
  });

  it('uses the selected trump to allow an equal-pair escalation', () => {
    const highest = declaration({ trumpType: 'club', numberOfPairs: 7 });

    expect(getValidBlowPairValues(highest, 'zuppe')).toEqual([8, 9, 10]);
    expect(getValidBlowPairValues(highest, 'herz')).toEqual([7, 8, 9, 10]);
  });
});
