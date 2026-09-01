import {
  fetchPlayerProfile,
  fetchPlayerProfileWithRetry,
  fetchProfileGameHistory,
  ProfileApiError,
  updateProfile,
} from '@/lib/profile-api';

jest.mock('@/lib/config', () => ({
  config: {
    backendUrl: 'https://backend.example.com',
  },
}));

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

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
      {
        headers: { Authorization: 'Bearer access-token' },
        signal: undefined,
      },
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
      { signal: undefined },
    );
  });

  it('retries transient server failures and then succeeds', async () => {
    const profile = { id: 'user-1', username: 'player', displayName: 'Player' };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue('temporarily unavailable'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(profile),
      });
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      fetchPlayerProfileWithRetry('user-1', { fetchImpl, wait }),
    ).resolves.toEqual(profile);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(500);
  });

  it('does not retry permanent profile errors', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('not found'),
    });
    const wait = jest.fn().mockResolvedValue(undefined);

    const error = await fetchPlayerProfileWithRetry('missing', {
      fetchImpl,
      wait,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProfileApiError);
    expect(error).toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('encodes the user id when updating an authenticated profile', async () => {
    const profile = {
      id: 'user/1',
      username: 'player',
      displayName: 'Updated Player',
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(profile),
    });
    global.fetch = fetchMock;

    await expect(
      updateProfile('user/1', 'access-token', {
        displayName: 'Updated Player',
      }),
    ).resolves.toEqual(profile);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/api/user-profile/user%2F1',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Updated Player' }),
        signal: undefined,
      },
    );
  });
});
