import { RecentGameHistoryItem } from '../../types/game-history.types';

export interface IGetUserRecentGameHistoryUseCase {
  execute(userId: string, limit?: number): Promise<RecentGameHistoryItem[]>;
}
