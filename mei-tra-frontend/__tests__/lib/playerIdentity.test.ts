import { resolveSelfPlayerId } from '@/lib/utils/playerIdentity';

describe('resolveSelfPlayerId', () => {
  const players = [
    { playerId: 'seat-1', userId: 'user-1' },
    { playerId: 'seat-2', userId: 'user-2' },
  ];

  it('prefers an authoritative server player id', () => {
    expect(
      resolveSelfPlayerId(players, {
        userId: 'user-1',
        serverPlayerId: 'seat-2',
        fallbackPlayerId: 'stale-seat',
      }),
    ).toBe('seat-2');
  });

  it('resolves the seat from the authenticated user before a stale fallback', () => {
    expect(
      resolveSelfPlayerId(players, {
        userId: 'user-1',
        fallbackPlayerId: 'seat-2',
      }),
    ).toBe('seat-1');
  });

  it('does not guess from an ambiguous user mapping', () => {
    expect(
      resolveSelfPlayerId(
        [
          ...players,
          { playerId: 'seat-3', userId: 'user-1' },
        ],
        { userId: 'user-1' },
      ),
    ).toBeNull();
  });
});
