import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@contracts/leaderboard';

export interface RankedPlayerResult {
  userId: string;
  won: boolean;
}

export interface ILeaderboardRepository {
  record(
    matchId: string,
    mode: LeaderboardMode,
    players: RankedPlayerResult[],
  ): Promise<void>;
  get(mode: LeaderboardMode, viewerId: string): Promise<LeaderboardResponse>;
}
