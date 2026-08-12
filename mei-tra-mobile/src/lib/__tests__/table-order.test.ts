import {
  getCardSeatPosition,
  getSeatOrderWithSelfBottom,
} from '@/lib/table-order';

const player = (id: string) => ({
  playerId: id,
  team: 0,
});

describe('getSeatOrderWithSelfBottom', () => {
  const players = [player('A'), player('B'), player('C'), player('D')];

  it('puts self at index 0 (bottom) and swaps indices 1/3', () => {
    // [A,B,C,D] rotate to C -> [C,D,A,B] -> swap 1&3 -> [C,B,A,D]
    const result = getSeatOrderWithSelfBottom(players, 'C');
    expect(result.map((p) => p?.playerId)).toEqual(['C', 'B', 'A', 'D']);
  });

  it('applies swap even when self is null or missing', () => {
    // [A,B,C,D] -> no rotation, swap to [0,3,2,1] -> [A,D,C,B]
    const resultNull = getSeatOrderWithSelfBottom(players, null);
    expect(resultNull.map((p) => p?.playerId)).toEqual(['A', 'D', 'C', 'B']);
    const resultMissing = getSeatOrderWithSelfBottom(players, 'X');
    expect(resultMissing.map((p) => p?.playerId)).toEqual(['A', 'D', 'C', 'B']);
  });

  it('handles self already at index 0', () => {
    const result = getSeatOrderWithSelfBottom(players, 'A');
    expect(result.map((p) => p?.playerId)).toEqual(['A', 'D', 'C', 'B']);
  });

  it('keeps unoccupied seats empty instead of duplicating a player', () => {
    const result = getSeatOrderWithSelfBottom(players.slice(0, 2), 'A');

    expect(result.map((p) => p?.playerId)).toEqual([
      'A',
      undefined,
      undefined,
      'B',
    ]);
  });
});

describe('getCardSeatPosition', () => {
  const ordered = [player('A'), player('B'), player('C'), player('D')];

  it('maps each player to their seat position', () => {
    expect(getCardSeatPosition('A', ordered)).toBe('bottom');
    expect(getCardSeatPosition('B', ordered)).toBe('left');
    expect(getCardSeatPosition('C', ordered)).toBe('top');
    expect(getCardSeatPosition('D', ordered)).toBe('right');
  });

  it('falls back to bottom for unknown player', () => {
    expect(getCardSeatPosition('X', ordered)).toBe('bottom');
  });
});
