import { fetchPlayerProfile, fetchProfileGameHistory } from '@/lib/profile-api';

jest.mock('@/lib/config', () => ({
  config: {
    backendUrl: 'https://backend.example.com',
  },
}));

describe('fetchProfileGameHistory', () => {
  it('loads the authenticated user recent matches', async () => {
    const history = [
      {
        roomId: 'room-1',
        roomName: 'Mobile match',
        completedAt: '2026-08-15T00:00:00.000Z',
        roundCount: 3,
        totalEntries: 120,
        winningTeam: 1,
        lastActionType: 'game_over' as const,
      },
    ];
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(history),
    });

    await expect(
      fetchProfileGameHistory('user/1', 'access-token', fetchImpl),
    ).resolves.toEqual(history);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://backend.example.com/api/user-profile/user%2F1/game-history',
      { headers: { Authorization: 'Bearer access-token' } },
    );
  });

  it('rejects failed history responses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue('forbidden'),
    });

    await expect(
      fetchProfileGameHistory('user-1', 'access-token', fetchImpl),
    ).rejects.toThrow('forbidden');
  });
});

describe('fetchPlayerProfile', () => {
  it('loads a public player profile with an encoded user id', async () => {
    const profile = {
      id: 'user/1',
      username: 'player',
      displayName: 'Player',
      avatarUrl: 'https://cdn.example.com/avatar.webp',
    };
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(profile),
    });

    await expect(fetchPlayerProfile('user/1', fetchImpl)).resolves.toEqual(
      profile,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://backend.example.com/api/user-profile/user%2F1',
    );
  });
});
