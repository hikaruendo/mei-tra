import {
  fetchUserProfileViaApi,
  isRetryableUserProfileError,
  updateUserProfileViaApi,
  UserProfileApiError,
} from '@/lib/api/user-profile';

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
      status: 404,
      text: jest.fn().mockResolvedValue(''),
      json: jest.fn().mockResolvedValue({ message: 'Profile not found' }),
    } as unknown as Response);

    await expect(fetchUserProfileViaApi('missing')).rejects.toThrow(
      'Profile not found',
    );
  });

  it('preserves the status so transient backend failures can be retried', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue(''),
      json: jest.fn().mockResolvedValue({ message: 'Temporarily unavailable' }),
    } as unknown as Response);

    const error = await fetchUserProfileViaApi('user-1').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(UserProfileApiError);
    expect(error).toMatchObject({ status: 503 });
    expect(isRetryableUserProfileError(error)).toBe(true);
    expect(
      isRetryableUserProfileError(new UserProfileApiError('missing', 404)),
    ).toBe(false);
  });

  it('encodes the user id and sends authenticated updates through the shared client', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'user/1',
        username: 'user',
        displayName: 'Updated User',
        avatarUrl: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
        lastSeenAt: '2026-04-03T00:00:00.000Z',
        gamesPlayed: 3,
        gamesWon: 2,
        totalScore: 10,
        preferences: {
          notifications: true,
          sound: true,
          theme: 'dark',
          fontSize: 'standard',
          startPlayerAnimation: true,
        },
      }),
    } as unknown as Response);
    global.fetch = fetchMock;

    await updateUserProfileViaApi('user/1', 'access-token', {
      displayName: 'Updated User',
      preferences: { sound: true },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/user-profile/user%2F1', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'Updated User',
        preferences: {
          notifications: undefined,
          sound: true,
          fontSize: undefined,
          startPlayerAnimation: undefined,
        },
      }),
      signal: undefined,
    });
  });
});
