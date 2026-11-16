import { asSeatId } from '../types/identity.types';
import { isLastPersonAtTable, isWaitingForAbsentOwner } from './absent-owner';

const seat = (
  id: string,
  overrides: { isCOM?: boolean; userId?: string | null } = {},
) => ({ seatId: asSeatId(id), isCOM: false, userId: null, ...overrides });

describe('isWaitingForAbsentOwner', () => {
  const connected =
    (...ids: string[]) =>
    (seatId: string) =>
      ids.includes(seatId);

  it('keeps playing while a person is at the table', () => {
    const players = [
      seat('a', { userId: 'user-a' }),
      seat('b', { isCOM: true }),
      seat('c', { isCOM: true, userId: 'user-c' }),
    ];
    expect(isWaitingForAbsentOwner(players, connected('a'))).toBe(false);
  });

  it('waits when the only person left has dropped their connection', () => {
    const players = [
      seat('a', { userId: 'user-a' }),
      seat('b', { isCOM: true }),
    ];
    expect(isWaitingForAbsentOwner(players, connected())).toBe(true);
  });

  it('waits when COM holds the seat of someone who left', () => {
    const players = [
      seat('a', { isCOM: true, userId: 'user-a' }),
      seat('b', { isCOM: true }),
    ];
    expect(isWaitingForAbsentOwner(players, connected())).toBe(true);
  });

  it('lets COM finish a game that nobody owns', () => {
    const players = [seat('a', { isCOM: true }), seat('b', { isCOM: true })];
    expect(isWaitingForAbsentOwner(players, connected())).toBe(false);
  });
});

describe('isLastPersonAtTable', () => {
  it('is true when everyone else at the table is COM', () => {
    const players = [
      seat('a', { userId: 'user-a' }),
      seat('b', { isCOM: true, userId: 'user-b' }),
    ];
    expect(isLastPersonAtTable(players, asSeatId('a'))).toBe(true);
  });

  it('is false while another person is still seated', () => {
    const players = [seat('a'), seat('b')];
    expect(isLastPersonAtTable(players, asSeatId('a'))).toBe(false);
  });
});
