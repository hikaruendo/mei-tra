import type {
  GameHistoryActionType,
  GameHistoryReplayDetailItemContract,
  GameHistoryReplayDetailValueContract,
  GameHistoryContextContract,
  GameHistoryEntryContract,
  GameHistoryReplayEventContract,
  GameHistoryReplayQueryContract,
  GameHistoryReplayRoundContract,
  GameHistoryReplayViewContract,
  RecentGameHistoryItemContract,
  GameHistorySummaryContract,
} from '@contracts/game-history';

export type GameHistoryReplayQuery = GameHistoryReplayQueryContract;
export type { GameHistoryActionType };
export type GameHistoryFilters = {
  round: 'all' | number;
  actionType: 'all' | GameHistoryActionType;
  playerId: 'all' | string;
};

export type GameHistoryContext = Omit<GameHistoryContextContract, 'teamScores'> & {
  teamScores?: GameHistoryContextContract['teamScores'];
};

export type GameHistoryEntry = Omit<GameHistoryEntryContract, 'timestamp'> & {
  timestamp: Date;
};

export type GameHistorySummary = Omit<
  GameHistorySummaryContract,
  'firstTimestamp' | 'lastTimestamp'
> & {
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
};

export type RecentGameHistoryItem = Omit<
  RecentGameHistoryItemContract,
  'completedAt'
> & {
  completedAt: Date;
};

export type GameHistoryReplayDetailValue = GameHistoryReplayDetailValueContract;
export type GameHistoryReplayDetailItem = GameHistoryReplayDetailItemContract;

export type GameHistoryReplayEvent = Omit<
  GameHistoryReplayEventContract,
  'timestamp' | 'context'
> & {
  timestamp: Date;
  context?: GameHistoryContext;
};

export type GameHistoryReplayRound = Omit<
  GameHistoryReplayRoundContract,
  'startedAt' | 'endedAt' | 'entries' | 'events'
> & {
  startedAt: Date | null;
  endedAt: Date | null;
  entries: GameHistoryEntry[];
  events: GameHistoryReplayEvent[];
};

export type GameHistoryReplayView = Omit<
  GameHistoryReplayViewContract,
  'rounds'
> & {
  rounds: GameHistoryReplayRound[];
};

function toDateOrNull(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function fromGameHistoryEntryContract(
  entry: GameHistoryEntryContract,
): GameHistoryEntry {
  return {
    ...entry,
    timestamp: new Date(entry.timestamp),
  };
}

function fromGameHistoryReplayEventContract(
  event: GameHistoryReplayEventContract,
): GameHistoryReplayEvent {
  return {
    ...event,
    timestamp: new Date(event.timestamp),
    context: event.context
      ? {
          ...event.context,
          teamScores: event.context.teamScores,
        }
      : undefined,
  };
}

function fromGameHistoryReplayRoundContract(
  round: GameHistoryReplayRoundContract,
): GameHistoryReplayRound {
  return {
    ...round,
    startedAt: toDateOrNull(round.startedAt),
    endedAt: toDateOrNull(round.endedAt),
    entries: round.entries.map(fromGameHistoryEntryContract),
    events: round.events.map(fromGameHistoryReplayEventContract),
  };
}

export function fromGameHistoryReplayViewContract(
  view: GameHistoryReplayViewContract,
): GameHistoryReplayView {
  return {
    ...view,
    rounds: view.rounds.map(fromGameHistoryReplayRoundContract),
  };
}

export function fromGameHistorySummaryContract(
  summary: GameHistorySummaryContract,
): GameHistorySummary {
  return {
    ...summary,
    firstTimestamp: toDateOrNull(summary.firstTimestamp),
    lastTimestamp: toDateOrNull(summary.lastTimestamp),
  };
}

export function fromRecentGameHistoryItemContract(
  item: RecentGameHistoryItemContract,
): RecentGameHistoryItem {
  return {
    ...item,
    completedAt: new Date(item.completedAt),
  };
}
