import type { PlayerContract } from '@meitra/contracts/game';

import {
  getCardSeatPosition,
  getSeatOrderWithSelfBottom,
} from '@/lib/table-order';

const player = (id: string): PlayerContract => ({
  socketId: `socket-${id}`,
  playerId: id,
  name: id,
  userId: `user-${id}`,
  team: 0,
  hand: [],
});

describe('getSeatOrderWithSelfBottom', () => {
  const players = [player('A'), player('B'), player('C'), player('D')];

  it('puts self at index 0 (bottom) and swaps indices 1/3', () => {
    // [A,B,C,D] rotate to C -> [C,D,A,B] -> swap 1&3 -> [C,B,A,D]
    const result = getSeatOrderWithSelfBottom(players, 'C');
    expect(result.map((p) => p.playerId)).toEqual(['C', 'B', 'A', 'D']);
  });

  it('returns original order for empty or missing self', () => {
    expect(getSeatOrderWithSelfBottom(players, null)).toBe(players);
    expect(getSeatOrderWithSelfBottom(players, 'X')).toBe(players);
  });

  it('handles self already at index 0', () => {
    const result = getSeatOrderWithSelfBottom(players, 'A');
    expect(result.map((p) => p.playerId)).toEqual(['A', 'D', 'C', 'B']);
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
