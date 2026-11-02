import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@contracts/leaderboard';

export interface ILeaderboardRepository {
  get(mode: LeaderboardMode, viewerId: string): Promise<LeaderboardResponse>;
}
