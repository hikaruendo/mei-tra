import {
  toLeaderboardResponse,
  toWinRateLeaderboard,
} from './leaderboard-adapters';

describe('toWinRateLeaderboard', () => {
  const entry = {
    user_id: 'user-1',
    display_name: 'Player 1',
    avatar_url: null,
    rank: 1,
    games_played: 12,
    games_won: 9,
    win_rate: 75,
  };
  const me = {
    user_id: 'user-2',
    rank: null,
    games_played: 3,
    games_won: 1,
    win_rate: 33.3,
  };

  it('reads the database result into the leaderboard', () => {
    expect(
      toWinRateLeaderboard({ minimum_games: 10, entries: [entry], me }),
    ).toEqual({
      minimumGames: 10,
      entries: [
        {
          userId: 'user-1',
          displayName: 'Player 1',
          avatarUrl: null,
          rank: 1,
          gamesPlayed: 12,
          gamesWon: 9,
          winRate: 75,
        },
      ],
      me: {
        userId: 'user-2',
        rank: null,
        gamesPlayed: 3,
        gamesWon: 1,
        winRate: 33.3,
      },
    });
  });

  it.each([
    null,
    [],
    { entries: [], me: null },
    { minimum_games: 10, me: null },
    { minimum_games: 10, entries: [] },
    { minimum_games: 10, entries: [{ ...entry, games_won: '9' }], me: null },
    { minimum_games: 10, entries: [], me: { ...me, user_id: null } },
  ])('rejects a malformed database result: %j', (result) => {
    expect(() => toWinRateLeaderboard(result)).toThrow(
      'Invalid leaderboard response',
    );
  });
});

describe('toLeaderboardResponse', () => {
  it('adds the requested mode', () => {
    expect(
      toLeaderboardResponse('pro', { minimumGames: 10, entries: [], me: null }),
    ).toEqual({ mode: 'pro', minimumGames: 10, entries: [], me: null });
  });
});
