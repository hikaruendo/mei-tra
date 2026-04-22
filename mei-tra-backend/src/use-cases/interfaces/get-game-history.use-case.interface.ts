import {
  GameHistoryEntry,
  GameHistoryQuery,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../../types/game-history.types';

export interface IGetGameHistoryUseCase {
  execute(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryEntry[]>;
  summarize(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistorySummary>;
  replay(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryReplayView>;
}
