import { GamePhase, TeamNames, TeamScores } from './game.types';
import type { SeatId } from './identity.types';

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

export const GAME_HISTORY_REPLAY_MEMBERSHIP_ACTION_TYPES = [
  'player_joined',
  'player_left',
] as const;

export type GameHistoryReplayMembershipActionType =
  (typeof GAME_HISTORY_REPLAY_MEMBERSHIP_ACTION_TYPES)[number];

export type GameHistoryReplayActionType =
  | GameHistoryActionType
  | GameHistoryReplayMembershipActionType;

export interface GameHistoryContext {
  roundNumber: number;
  gamePhase: GamePhase;
  currentTurnSeatId: SeatId | null;
  teamScores?: TeamScores;
}

export interface GameHistoryEntry {
  id: string;
  roomId: string;
  gameStateId: string;
  actionType: GameHistoryActionType;
  actorSeatId: SeatId | null;
  actorKeySnapshot: string | null;
  actionData: Record<string, unknown>;
  timestamp: Date;
}

export interface GameHistoryQuery {
  actionType?: GameHistoryActionType;
  actorSeatId?: SeatId;
  roundNumber?: number;
  limit?: number;
  since?: Date;
  until?: Date;
}

export interface GameHistorySummary {
  roomId: string;
  totalEntries: number;
  byActionType: Partial<Record<GameHistoryReplayActionType, number>>;
  actorSeatIds: SeatId[];
  playerNames: Record<string, string>;
  teamNames?: TeamNames;
  status: 'completed' | 'in_progress';
  winningTeam: number | null;
  lastActionType: GameHistoryReplayActionType | null;
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
  teamNames?: TeamNames;
  winningTeam: number | null;
  lastActionType: GameHistoryActionType | null;
}

export interface GameHistoryReplayRound {
  roundNumber: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  viewerStartingHand?: string[];
  actionTypes: GameHistoryReplayActionType[];
  actorSeatIds: SeatId[];
  entries: GameHistoryEntry[];
  events: GameHistoryReplayEvent[];
}

export interface GameHistoryReplayView {
  roomId: string;
  totalEntries: number;
  rounds: GameHistoryReplayRound[];
}

export interface GameStartedReplayDetails {
  firstBlowSeatId: SeatId | null;
  startedBySeatId: SeatId | null;
  pointsToWin: number | null;
}

export interface BlowDeclaredReplayDetails {
  declaration: Record<string, unknown> | null;
  currentHighestDeclaration: Record<string, unknown> | null;
}

export interface BlowPassedReplayDetails {
  lastPasserSeatId: SeatId | null;
  actedCount: number | null;
}

export interface PlayPhaseStartedReplayDetails {
  winnerSeatId: SeatId | null;
  currentTrump: string | null;
  revealBrokenRequired: boolean;
}

export interface CardPlayedReplayDetails {
  card: string | null;
  fieldCards: string[];
  baseCard: string | null;
}

export interface FieldCompletedReplayDetails {
  winnerSeatId: SeatId | null;
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
  nextDealerSeatId: SeatId | null;
}

export interface BrokenHandRevealedReplayDetails {
  nextSeatId: SeatId | null;
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

export interface PlayerMembershipReplayDetails {
  seatId: SeatId | null;
  playerName: string | null;
}

export type GameHistoryReplayDetailValue =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'player';
      seatId: SeatId | null;
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
  TAction extends GameHistoryReplayActionType,
  TKind extends
    | 'lifecycle'
    | 'blow'
    | 'play'
    | 'round'
    | 'stats'
    | 'membership',
  TDetails,
> = {
  id: string;
  timestamp: Date;
  actionType: TAction;
  kind: TKind;
  actorSeatId: SeatId | null;
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
    >
  | GameHistoryReplayEventBase<
      'player_joined',
      'membership',
      PlayerMembershipReplayDetails
    >
  | GameHistoryReplayEventBase<
      'player_left',
      'membership',
      PlayerMembershipReplayDetails
    >;

export interface CreateGameHistoryEntry {
  roomId: string;
  gameStateId?: string;
  actionType: GameHistoryActionType;
  actorSeatId?: SeatId | null;
  actionData?: Record<string, unknown>;
}
