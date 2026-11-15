import { toLeaderboardResponse } from './leaderboard-adapters';

describe('toLeaderboardResponse', () => {
  it('passes the qualifying match count through from the query', () => {
    expect(
      toLeaderboardResponse('pro', { minimumGames: 10, entries: [], me: null }),
    ).toEqual({ mode: 'pro', minimumGames: 10, entries: [], me: null });
  });

  it.each([
    null,
    [],
    { entries: [], me: null },
    { minimumGames: 10, me: null },
    { minimumGames: 10, entries: [] },
  ])('rejects a malformed query result: %j', (result) => {
    expect(() => toLeaderboardResponse('normal', result)).toThrow(
      'Invalid leaderboard response',
    );
  });
});
