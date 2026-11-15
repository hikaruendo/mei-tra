import { createLeaderboardApiClient } from '@meitra/api-client/leaderboard';
import { config } from '@/lib/config';

export const leaderboardApi = createLeaderboardApiClient({
  baseUrl: `${config.backendUrl}/api/leaderboard`,
});
