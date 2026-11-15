import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@contracts/leaderboard';
import type { Json } from '../types/database.generated.types';

/** Turns the result of `get_win_rate_leaderboard` into the leaderboard response. */
export function toLeaderboardResponse(
  mode: LeaderboardMode,
  result: Json,
): LeaderboardResponse {
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    typeof result.minimumGames !== 'number' ||
    !Array.isArray(result.entries) ||
    !('me' in result)
  ) {
    throw new Error('Invalid leaderboard response');
  }
  const leaderboard = result as unknown as Omit<LeaderboardResponse, 'mode'>;
  return {
    mode,
    minimumGames: leaderboard.minimumGames,
    entries: leaderboard.entries,
    me: leaderboard.me,
  };
}
