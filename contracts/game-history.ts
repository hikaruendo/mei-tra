import type { TransportGamePhase, TransportTeamScores } from './game';

export type GameHistoryActionType =
  | 'game_started'
  | 'blow_declared'
  | 'blow_passed'
  | 'play_phase_started'
  | 'card_played'
  | 'field_completed'
  | 'round_completed'
  | 'round_cancelled'
  | 'round_reset'
  | 'broken_hand_revealed'
  | 'game_over'
  | 'player_stats_updated';

export interface GameHistoryContextContract {
  roundNumber: number;
  gamePhase: TransportGamePhase | null;
  currentPlayerIndex: number;
  currentTurnPlayerId: string | null;
  teamScores?: TransportTeamScores;
}

export interface GameHistoryEntryContract {
  id: string;
  roomId: string;
  gameStateId: string;
  actionType: GameHistoryActionType;
  playerId: string | null;
  actionData: Record<string, unknown>;
  timestamp: string;
}

export interface GameHistorySummaryContract {
  roomId: string;
  totalEntries: number;
  byActionType: Partial<Record<GameHistoryActionType, number>>;
  playerIds: string[];
  playerNames: Record<string, string>;
  status: 'completed' | 'in_progress';
  winningTeam: number | null;
  lastActionType: GameHistoryActionType | null;
  roundNumbers: number[];
  firstTimestamp: string | null;
  lastTimestamp: string | null;
}

export interface GameHistoryReplayRoundContract {
  roundNumber: number | null;
  startedAt: string | null;
  endedAt: string | null;
  actionTypes: GameHistoryActionType[];
  playerIds: string[];
  entries: GameHistoryEntryContract[];
  events: GameHistoryReplayEventContract[];
}

export interface GameHistoryReplayViewContract {
  roomId: string;
  totalEntries: number;
  rounds: GameHistoryReplayRoundContract[];
}

export interface GameStartedReplayDetailsContract {
  firstBlowPlayerId: string | null;
  startedByPlayerId: string | null;
  pointsToWin: number | null;
}

export interface BlowDeclaredReplayDetailsContract {
  declaration: Record<string, unknown> | null;
  currentHighestDeclaration: Record<string, unknown> | null;
}

export interface BlowPassedReplayDetailsContract {
  lastPasser: string | null;
  actedCount: number | null;
}

export interface PlayPhaseStartedReplayDetailsContract {
  winnerPlayerId: string | null;
  currentTrump: string | null;
  revealBrokenRequired: boolean;
}

export interface CardPlayedReplayDetailsContract {
  card: string | null;
  fieldCards: string[];
  baseCard: string | null;
}

export interface FieldCompletedReplayDetailsContract {
  winnerPlayerId: string | null;
  winnerTeam: number | null;
  cards: string[];
}

export interface RoundCompletedReplayDetailsContract {
  declaringTeam: number | null;
  teamScores: Record<string, unknown> | null;
}

export interface RoundCancelledReplayDetailsContract {
  highestDeclaration: Record<string, unknown> | null;
}

export interface RoundResetReplayDetailsContract {
  nextDealerId: string | null;
}

export interface BrokenHandRevealedReplayDetailsContract {
  nextPlayerId: string | null;
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

export type GameHistoryReplayDetailValueContract =
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

export interface GameHistoryReplayDetailItemContract {
  labelKey: string;
  value: GameHistoryReplayDetailValueContract;
}

type GameHistoryReplayEventBaseContract<
  TAction extends GameHistoryActionType,
  TKind extends 'lifecycle' | 'blow' | 'play' | 'round' | 'stats',
  TDetails,
> = {
  id: string;
  timestamp: string;
  actionType: TAction;
  kind: TKind;
  playerId: string | null;
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
    >;

export interface GameHistoryReplayQueryContract {
  limit?: number;
  roundNumber?: number;
  actionType?: GameHistoryActionType;
  playerId?: string;
  since?: string;
  until?: string;
}
