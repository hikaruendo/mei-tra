import type { LeaderboardResponse } from '@contracts/leaderboard';
import { isGameMode } from '@contracts/room';
import {
  createLeaderboardApiClient,
  LeaderboardApiError,
  loadLeaderboard,
} from '@meitra/api-client/leaderboard';
import { describeLeaderboardStanding } from '@meitra/game-client/leaderboard-standing';

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
      key: 'myRank',
      values: { rank: 4, wins: 3, games: 12 },
    });
  });

  it('counts down to the qualifying match count from the response', () => {
    expect(describeLeaderboardStanding(leaderboard(self(3), 8), false)).toEqual({
      key: 'progress',
      values: { games: 3, remaining: 5 },
    });
    expect(describeLeaderboardStanding(leaderboard(null), false)).toEqual({
      key: 'progress',
      values: { games: 0, remaining: 10 },
    });
  });

  it('does not count down to zero for a qualified player who is not listed', () => {
    expect(describeLeaderboardStanding(leaderboard(self(12)), false)).toEqual({
      key: 'unlisted',
      values: { games: 12 },
    });
  });

  it('tells a guest to register once they have played enough', () => {
    expect(describeLeaderboardStanding(leaderboard(self(9)), true)).toEqual({
      key: 'guestProgress',
      values: { games: 9, remaining: 1 },
    });
    expect(describeLeaderboardStanding(leaderboard(self(10)), true)).toEqual({
      key: 'guestNote',
      values: { minimumGames: 10 },
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

describe('loadLeaderboard', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('reports the loaded leaderboard', async () => {
    const body = leaderboard(null);
    const onLoaded = jest.fn();
    const onFailed = jest.fn();
    loadLeaderboard({
      client: { fetchLeaderboard: jest.fn().mockResolvedValue(body) },
      mode: 'normal',
      getAccessToken: () => Promise.resolve('token-1'),
      onLoaded,
      onFailed,
    });
    await flush();

    expect(onLoaded).toHaveBeenCalledWith(body);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('fails without a session', async () => {
    const onFailed = jest.fn();
    const fetchLeaderboard = jest.fn();
    loadLeaderboard({
      client: { fetchLeaderboard },
      mode: 'normal',
      getAccessToken: () => Promise.resolve(null),
      onLoaded: jest.fn(),
      onFailed,
    });
    await flush();

    expect(onFailed).toHaveBeenCalled();
    expect(fetchLeaderboard).not.toHaveBeenCalled();
  });

  it('reports nothing once cancelled', async () => {
    const onLoaded = jest.fn();
    const cancel = loadLeaderboard({
      client: { fetchLeaderboard: jest.fn().mockResolvedValue(leaderboard(null)) },
      mode: 'normal',
      getAccessToken: () => Promise.resolve('token-1'),
      onLoaded,
      onFailed: jest.fn(),
    });
    cancel();
    await flush();

    expect(onLoaded).not.toHaveBeenCalled();
  });
});

describe('isGameMode', () => {
  it('accepts only the game modes', () => {
    expect(isGameMode('normal')).toBe(true);
    expect(isGameMode('pro')).toBe(true);
    expect(isGameMode('expert')).toBe(false);
    expect(isGameMode(null)).toBe(false);
  });
});
