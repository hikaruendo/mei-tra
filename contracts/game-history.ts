import type {
  TeamNames,
  TransportGamePhase,
  TransportTeamScores,
} from './game';
import type { SeatId } from './ids';

export type GameHistoryActionType =
  | 'game_started'
  | 'blow_declared'
  | 'blow_passed'
  | 'play_phase_started'
  | 'card_played'
  | 'field_recovered'
  | 'field_completed'
  | 'round_completed'
  | 'round_cancelled'
  | 'round_reset'
  | 'broken_hand_revealed'
  | 'game_over'
  | 'player_stats_updated';

export type GameHistoryReplayMembershipActionType =
  | 'player_joined'
  | 'player_left';

export type GameHistoryReplayActionType =
  | GameHistoryActionType
  | GameHistoryReplayMembershipActionType;

export interface GameHistoryContextContract {
  roundNumber: number;
  gamePhase: TransportGamePhase | null;
  currentTurnSeatId: SeatId | null;
  teamScores?: TransportTeamScores;
}

export interface GameHistoryEntryContract {
  id: string;
  roomId: string;
  gameStateId: string;
  actionType: GameHistoryActionType;
  actorSeatId: SeatId | null;
  actorKeySnapshot?: string | null;
  actionData: Record<string, unknown>;
  timestamp: string;
}

export interface GameHistorySummaryContract {
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
  firstTimestamp: string | null;
  lastTimestamp: string | null;
}

export interface RecentGameHistoryItemContract {
  roomId: string;
  roomName: string;
  completedAt: string;
  roundCount: number;
  totalEntries: number;
  teamNames?: TeamNames;
  winningTeam: number | null;
  lastActionType: GameHistoryActionType | null;
}

export interface GameHistoryReplayRoundContract {
  roundNumber: number | null;
  startedAt: string | null;
  endedAt: string | null;
  viewerStartingHand?: string[];
  actionTypes: GameHistoryReplayActionType[];
  actorSeatIds: SeatId[];
  entries: GameHistoryEntryContract[];
  events: GameHistoryReplayEventContract[];
}

export interface GameHistoryReplayViewContract {
  roomId: string;
  totalEntries: number;
  rounds: GameHistoryReplayRoundContract[];
}

export interface GameStartedReplayDetailsContract {
  firstBlowSeatId: SeatId | null;
  startedBySeatId: SeatId | null;
  pointsToWin: number | null;
}

export interface BlowDeclaredReplayDetailsContract {
  declaration: Record<string, unknown> | null;
  currentHighestDeclaration: Record<string, unknown> | null;
}

export interface BlowPassedReplayDetailsContract {
  lastPasserSeatId: SeatId | null;
  actedCount: number | null;
}

export interface PlayPhaseStartedReplayDetailsContract {
  winnerSeatId: SeatId | null;
  currentTrump: string | null;
  revealBrokenRequired: boolean;
}

export interface CardPlayedReplayDetailsContract {
  card: string | null;
  fieldCards: string[];
  baseCard: string | null;
}

export interface FieldCompletedReplayDetailsContract {
  winnerSeatId: SeatId | null;
  winnerTeam: number | null;
  cards: string[];
}

export interface FieldRecoveredReplayDetailsContract {
  reason: string | null;
  fieldIndex: number | null;
  abandonedCards: string[];
}

export interface RoundCompletedReplayDetailsContract {
  declaringTeam: number | null;
  teamScores: Record<string, unknown> | null;
}

export interface RoundCancelledReplayDetailsContract {
  highestDeclaration: Record<string, unknown> | null;
}

export interface RoundResetReplayDetailsContract {
  nextDealerSeatId: SeatId | null;
}

export interface BrokenHandRevealedReplayDetailsContract {
  nextSeatId: SeatId | null;
  nextBlowIndex: number | null;
}

export interface GameOverReplayDetailsContract {
  winningTeam: number | null;
  finalScores: Record<string, unknown> | null;
}

export interface PlayerStatsUpdatedReplayDetailsContract {
  winningTeam: number | null;
  updatedPlayers: string[];
  skippedPlayers: string[];
  updatedCount: number;
  failedCount: number;
}

export interface PlayerMembershipReplayDetailsContract {
  seatId: SeatId | null;
  playerName: string | null;
}

export type GameHistoryReplayDetailValueContract =
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

export interface GameHistoryReplayDetailItemContract {
  labelKey: string;
  value: GameHistoryReplayDetailValueContract;
}

type GameHistoryReplayEventBaseContract<
  TAction extends GameHistoryReplayActionType,
  TKind extends 'lifecycle' | 'blow' | 'play' | 'round' | 'stats' | 'membership',
  TDetails,
> = {
  id: string;
  timestamp: string;
  actionType: TAction;
  kind: TKind;
  actorSeatId: SeatId | null;
  roundNumber: number | null;
  gamePhase: TransportGamePhase | null;
  summary: string;
  details: TDetails;
  detailItems: GameHistoryReplayDetailItemContract[];
  context?: GameHistoryContextContract;
  actionData: Record<string, unknown>;
};

export type GameHistoryReplayEventContract =
  | GameHistoryReplayEventBaseContract<
      'game_started',
      'lifecycle',
      GameStartedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'blow_declared',
      'blow',
      BlowDeclaredReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'blow_passed',
      'blow',
      BlowPassedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'play_phase_started',
      'blow',
      PlayPhaseStartedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'card_played',
      'play',
      CardPlayedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'field_recovered',
      'play',
      FieldRecoveredReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'field_completed',
      'play',
      FieldCompletedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'round_completed',
      'round',
      RoundCompletedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'round_cancelled',
      'round',
      RoundCancelledReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'round_reset',
      'round',
      RoundResetReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'broken_hand_revealed',
      'blow',
      BrokenHandRevealedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'game_over',
      'lifecycle',
      GameOverReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'player_stats_updated',
      'stats',
      PlayerStatsUpdatedReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'player_joined',
      'membership',
      PlayerMembershipReplayDetailsContract
    >
  | GameHistoryReplayEventBaseContract<
      'player_left',
      'membership',
      PlayerMembershipReplayDetailsContract
    >;

export interface GameHistoryReplayQueryContract {
  limit?: number;
  roundNumber?: number;
  actionType?: GameHistoryActionType;
  actorSeatId?: SeatId;
  since?: string;
  until?: string;
}
