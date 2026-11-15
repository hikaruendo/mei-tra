import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@contracts/leaderboard';

export interface ILeaderboardRepository {
  getWinRateLeaderboard(
    mode: LeaderboardMode,
    viewerId: string,
  ): Promise<LeaderboardResponse>;
}
