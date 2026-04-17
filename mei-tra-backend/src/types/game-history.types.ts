import { GamePhase, TeamScores } from './game.types';

export const GAME_HISTORY_ACTION_TYPES = [
  'game_started',
  'blow_declared',
  'blow_passed',
  'play_phase_started',
  'card_played',
  'field_completed',
  'round_completed',
  'round_cancelled',
  'round_reset',
  'broken_hand_revealed',
  'game_over',
  'player_stats_updated',
] as const;

export type GameHistoryActionType = (typeof GAME_HISTORY_ACTION_TYPES)[number];

export interface GameHistoryContext {
  roundNumber: number;
  gamePhase: GamePhase;
  currentPlayerIndex: number;
  currentTurnPlayerId: string | null;
  teamScores?: TeamScores;
}

export interface GameHistoryEntry {
  id: string;
  roomId: string;
  gameStateId: string;
  actionType: GameHistoryActionType;
  playerId: string | null;
  actionData: Record<string, unknown>;
  timestamp: Date;
}

export interface GameHistoryQuery {
  actionType?: GameHistoryActionType;
  playerId?: string;
  roundNumber?: number;
  limit?: number;
  since?: Date;
  until?: Date;
}

export interface GameHistorySummary {
  roomId: string;
  totalEntries: number;
  byActionType: Partial<Record<GameHistoryActionType, number>>;
  playerIds: string[];
  playerNames: Record<string, string>;
  status: 'completed' | 'in_progress';
  winningTeam: number | null;
  lastActionType: GameHistoryActionType | null;
  roundNumbers: number[];
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
}

export interface RecentGameHistoryItem {
  roomId: string;
  roomName: string;
  completedAt: Date;
  roundCount: number;
  totalEntries: number;
  winningTeam: number | null;
  lastActionType: GameHistoryActionType | null;
}

export interface GameHistoryReplayRound {
  roundNumber: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  actionTypes: GameHistoryActionType[];
  playerIds: string[];
  entries: GameHistoryEntry[];
  events: GameHistoryReplayEvent[];
}

export interface GameHistoryReplayView {
  roomId: string;
  totalEntries: number;
  rounds: GameHistoryReplayRound[];
}

export interface GameStartedReplayDetails {
  firstBlowPlayerId: string | null;
  startedByPlayerId: string | null;
  pointsToWin: number | null;
}

export interface BlowDeclaredReplayDetails {
  declaration: Record<string, unknown> | null;
  currentHighestDeclaration: Record<string, unknown> | null;
}

export interface BlowPassedReplayDetails {
  lastPasser: string | null;
  actedCount: number | null;
}

export interface PlayPhaseStartedReplayDetails {
  winnerPlayerId: string | null;
  currentTrump: string | null;
  revealBrokenRequired: boolean;
}

export interface CardPlayedReplayDetails {
  card: string | null;
  fieldCards: string[];
  baseCard: string | null;
}

export interface FieldCompletedReplayDetails {
  winnerPlayerId: string | null;
  winnerTeam: number | null;
  cards: string[];
}

export interface RoundCompletedReplayDetails {
  declaringTeam: number | null;
  teamScores: Record<string, unknown> | null;
}

export interface RoundCancelledReplayDetails {
  highestDeclaration: Record<string, unknown> | null;
}

export interface RoundResetReplayDetails {
  nextDealerId: string | null;
}

export interface BrokenHandRevealedReplayDetails {
  nextPlayerId: string | null;
  nextBlowIndex: number | null;
}

export interface GameOverReplayDetails {
  winningTeam: number | null;
  finalScores: Record<string, unknown> | null;
}

export interface PlayerStatsUpdatedReplayDetails {
  winningTeam: number | null;
  updatedPlayers: string[];
  skippedPlayers: string[];
  updatedCount: number;
  failedCount: number;
}

export type GameHistoryReplayDetailValue =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'player';
      playerId: string | null;
      playerName: string | null;
    }
  | {
      kind: 'team';
      team: number | null;
    }
  | {
      kind: 'trump';
      trump: string | null;
    }
  | {
      kind: 'number';
      value: number | null;
    }
  | {
      kind: 'cards';
      cards: string[];
    }
  | {
      kind: 'scores';
      scores: Record<string, unknown> | null;
    };

export interface GameHistoryReplayDetailItem {
  labelKey: string;
  value: GameHistoryReplayDetailValue;
}

type GameHistoryReplayEventBase<
  TAction extends GameHistoryActionType,
  TKind extends 'lifecycle' | 'blow' | 'play' | 'round' | 'stats',
  TDetails,
> = {
  id: string;
  timestamp: Date;
  actionType: TAction;
  kind: TKind;
  playerId: string | null;
  roundNumber: number | null;
  gamePhase: GamePhase | null;
  summary: string;
  details: TDetails;
  detailItems: GameHistoryReplayDetailItem[];
  context?: GameHistoryContext;
  actionData: Record<string, unknown>;
};

export type GameHistoryReplayEvent =
  | GameHistoryReplayEventBase<
      'game_started',
      'lifecycle',
      GameStartedReplayDetails
    >
  | GameHistoryReplayEventBase<
      'blow_declared',
      'blow',
      BlowDeclaredReplayDetails
    >
  | GameHistoryReplayEventBase<'blow_passed', 'blow', BlowPassedReplayDetails>
  | GameHistoryReplayEventBase<
      'play_phase_started',
      'blow',
      PlayPhaseStartedReplayDetails
    >
  | GameHistoryReplayEventBase<'card_played', 'play', CardPlayedReplayDetails>
  | GameHistoryReplayEventBase<
      'field_completed',
      'play',
      FieldCompletedReplayDetails
    >
  | GameHistoryReplayEventBase<
      'round_completed',
      'round',
      RoundCompletedReplayDetails
    >
  | GameHistoryReplayEventBase<
      'round_cancelled',
      'round',
      RoundCancelledReplayDetails
    >
  | GameHistoryReplayEventBase<'round_reset', 'round', RoundResetReplayDetails>
  | GameHistoryReplayEventBase<
      'broken_hand_revealed',
      'blow',
      BrokenHandRevealedReplayDetails
    >
  | GameHistoryReplayEventBase<'game_over', 'lifecycle', GameOverReplayDetails>
  | GameHistoryReplayEventBase<
      'player_stats_updated',
      'stats',
      PlayerStatsUpdatedReplayDetails
    >;

export interface CreateGameHistoryEntry {
  roomId: string;
  gameStateId?: string;
  actionType: GameHistoryActionType;
  playerId?: string | null;
  actionData?: Record<string, unknown>;
}
