import { fetchUserProfileViaApi } from '@/lib/api/user-profile';

describe('fetchUserProfileViaApi', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads and maps a profile through the backend API', async () => {
    const signal = new AbortController().signal;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'user/1',
        username: 'user',
        displayName: 'User',
        avatarUrl: 'https://example.test/avatar.webp',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
        lastSeenAt: '2026-04-03T00:00:00.000Z',
        gamesPlayed: 3,
        gamesWon: 2,
        totalScore: 10,
        preferences: {
          notifications: true,
          sound: false,
          theme: 'dark',
          fontSize: 'standard',
          startPlayerAnimation: true,
        },
      }),
    } as unknown as Response);
    global.fetch = fetchMock;

    await expect(fetchUserProfileViaApi('user/1', signal)).resolves.toEqual(
      expect.objectContaining({
        id: 'user/1',
        displayName: 'User',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        preferences: expect.objectContaining({ sound: false }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/user-profile/user%2F1', {
      signal,
    });
  });

  it('surfaces backend errors without exposing database response types', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ message: 'Profile not found' }),
    } as unknown as Response);

    await expect(fetchUserProfileViaApi('missing')).rejects.toThrow(
      'Profile not found',
    );
  });
});
