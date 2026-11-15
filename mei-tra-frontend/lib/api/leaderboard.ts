import { createLeaderboardApiClient } from '@meitra/api-client/leaderboard';

export const leaderboardApi = createLeaderboardApiClient({
  baseUrl: '/api/leaderboard',
});
