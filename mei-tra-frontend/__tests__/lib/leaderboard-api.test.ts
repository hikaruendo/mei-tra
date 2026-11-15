import type { LeaderboardResponse } from '@contracts/leaderboard';
import { isLeaderboardMode } from '@contracts/leaderboard';
import {
  createLeaderboardApiClient,
  describeLeaderboardStanding,
  LeaderboardApiError,
} from '@meitra/api-client/leaderboard';

const leaderboard = (
  me: LeaderboardResponse['me'],
  minimumGames = 10,
): LeaderboardResponse => ({ mode: 'normal', minimumGames, entries: [], me });

const self = (gamesPlayed: number, rank: number | null = null) => ({
  userId: 'user-1',
  rank,
  gamesPlayed,
  gamesWon: 3,
  winRate: 50,
});

describe('describeLeaderboardStanding', () => {
  it('shows the rank of a ranked player', () => {
    expect(describeLeaderboardStanding(leaderboard(self(12, 4)), false)).toEqual({
      kind: 'ranked',
      rank: 4,
      gamesWon: 3,
      gamesPlayed: 12,
    });
  });

  it('counts down to the qualifying match count from the response', () => {
    expect(describeLeaderboardStanding(leaderboard(self(3), 8), false)).toEqual({
      kind: 'progress',
      gamesPlayed: 3,
      remaining: 5,
    });
    expect(describeLeaderboardStanding(leaderboard(null), false)).toEqual({
      kind: 'progress',
      gamesPlayed: 0,
      remaining: 10,
    });
  });

  it('tells a guest to register once they have played enough', () => {
    expect(describeLeaderboardStanding(leaderboard(self(9)), true)).toEqual({
      kind: 'guestProgress',
      gamesPlayed: 9,
      remaining: 1,
    });
    expect(describeLeaderboardStanding(leaderboard(self(10)), true)).toEqual({
      kind: 'guestQualified',
      minimumGames: 10,
    });
  });
});

describe('createLeaderboardApiClient', () => {
  it('requests the mode with the bearer token', async () => {
    const body = leaderboard(null);
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(body),
    });
    const client = createLeaderboardApiClient({ baseUrl: '/api/leaderboard/', fetchImpl });

    await expect(client.fetchLeaderboard('pro', 'token-1')).resolves.toBe(body);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/leaderboard?mode=pro',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: 'Bearer token-1' },
      }),
    );
  });

  it('reports the status of a failed request', async () => {
    const client = createLeaderboardApiClient({
      baseUrl: '/api/leaderboard',
      fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 503 }),
    });

    await expect(client.fetchLeaderboard('normal', 'token-1')).rejects.toEqual(
      new LeaderboardApiError(503),
    );
  });
});

describe('isLeaderboardMode', () => {
  it('accepts only the ranked modes', () => {
    expect(isLeaderboardMode('normal')).toBe(true);
    expect(isLeaderboardMode('pro')).toBe(true);
    expect(isLeaderboardMode('expert')).toBe(false);
    expect(isLeaderboardMode(null)).toBe(false);
  });
});
