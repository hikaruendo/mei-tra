import { GameState } from '../../types/game.types';
import {
  GameHistoryActionType,
  GameHistoryEntry,
  GameHistoryQuery,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../../types/game-history.types';
import type { SeatId } from '../../types/identity.types';

export interface LogGameEventInput {
  roomId: string;
  actionType: GameHistoryActionType;
  actorSeatId?: SeatId | null;
  /** @deprecated Use actorSeatId. */
  playerId?: string | null;
  state?: Pick<
    GameState,
    'players' | 'currentSeatId' | 'gamePhase' | 'roundNumber' | 'teamScores'
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
    playerNameOverrides?: Readonly<Record<string, string>>,
  ): Promise<GameHistorySummary>;
  replayByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
    playerNameOverrides?: Readonly<Record<string, string>>,
  ): Promise<GameHistoryReplayView>;
  pruneFinishedRoomHistory?(keepRecentRooms?: number): Promise<number>;
}
