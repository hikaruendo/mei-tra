import type { GameMode } from '../../types/room.types';
import type { WinRateLeaderboard } from '../../types/leaderboard.types';

export interface ILeaderboardRepository {
  getWinRateLeaderboard(
    mode: GameMode,
    viewerId: string,
  ): Promise<WinRateLeaderboard>;
}
