import { resolveSelfSeatId } from '@/lib/utils/playerIdentity';

describe('resolveSelfSeatId', () => {
  const players = [
    { seatId: 'seat-1', userId: 'user-1' },
    { seatId: 'seat-2', userId: 'user-2' },
  ];

  it('prefers an authoritative server player id', () => {
    expect(
      resolveSelfSeatId(players, {
        userId: 'user-1',
        serverSeatId: 'seat-2',
        fallbackSeatId: 'stale-seat',
      }),
    ).toBe('seat-2');
  });

  it('resolves the seat from the authenticated user before a stale fallback', () => {
    expect(
      resolveSelfSeatId(players, {
        userId: 'user-1',
        fallbackSeatId: 'seat-2',
      }),
    ).toBe('seat-1');
  });

  it('does not guess from an ambiguous user mapping', () => {
    expect(
      resolveSelfSeatId(
        [
          ...players,
          { seatId: 'seat-3', userId: 'user-1' },
        ],
        { userId: 'user-1' },
      ),
    ).toBeNull();
  });
});
