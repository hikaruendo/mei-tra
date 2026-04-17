import { GameState } from '../../types/game.types';
import {
  GameHistoryActionType,
  GameHistoryEntry,
  GameHistoryQuery,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../../types/game-history.types';

export interface LogGameEventInput {
  roomId: string;
  actionType: GameHistoryActionType;
  playerId?: string | null;
  state?: Pick<
    GameState,
    | 'players'
    | 'currentPlayerIndex'
    | 'gamePhase'
    | 'roundNumber'
    | 'teamScores'
  >;
  actionData?: Record<string, unknown>;
}

export interface IGameEventLogService {
  log(input: LogGameEventInput): Promise<void>;
  listByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryEntry[]>;
  summarizeByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistorySummary>;
  replayByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryReplayView>;
}
