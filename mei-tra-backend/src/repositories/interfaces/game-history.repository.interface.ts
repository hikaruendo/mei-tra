import {
  CreateGameHistoryEntry,
  GameHistoryEntry,
  GameHistoryQuery,
} from '../../types/game-history.types';

export interface IGameHistoryRepository {
  create(entry: CreateGameHistoryEntry): Promise<GameHistoryEntry>;
  findByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryEntry[]>;
  deleteForFinishedRoomsOutsideRecentLimit(limit: number): Promise<number>;
}
