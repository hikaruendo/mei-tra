'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useGameHistory } from '@/hooks/useGameHistory';
import { Link } from '@/i18n/routing';
import { CardFace } from '@/components/game/CardFace';
import type {
  GameHistoryActionType,
  GameHistoryFilters,
  GameHistoryReplayDetailItem,
  GameHistoryReplayEvent,
  GameHistoryReplayRound,
  GameHistorySummary,
} from '@/types/game-history.types';
import type { Player } from '@/types/game.types';
import styles from './GameHistoryDock.module.scss';

interface GameHistoryDockProps {
  roomId: string;
  gameStarted: boolean;
  players?: Player[];
  variant?: 'dock' | 'page';
  showOverview?: boolean;
  summaryOverride?: GameHistorySummary | null;
  includeSummaryFetch?: boolean;
  onFiltersChange?: (filters: GameHistoryFilters) => void;
}

const ACTION_TYPE_OPTIONS: GameHistoryActionType[] = [
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
];

const ACTION_TYPE_MESSAGE_KEYS: Record<GameHistoryActionType, string> = {
  game_started: 'actionTypes.game_started',
  blow_declared: 'actionTypes.blow_declared',
  blow_passed: 'actionTypes.blow_passed',
  play_phase_started: 'actionTypes.play_phase_started',
  card_played: 'actionTypes.card_played',
  field_completed: 'actionTypes.field_completed',
  round_completed: 'actionTypes.round_completed',
  round_cancelled: 'actionTypes.round_cancelled',
  round_reset: 'actionTypes.round_reset',
  broken_hand_revealed: 'actionTypes.broken_hand_revealed',
  game_over: 'actionTypes.game_over',
  player_stats_updated: 'actionTypes.player_stats_updated',
};

const extractScoreTotals = (
  value: Record<string, unknown> | null,
): Record<string, number> => {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([teamKey, teamValue]) => {
        if (
          !teamValue ||
          typeof teamValue !== 'object' ||
          typeof (teamValue as { total?: unknown }).total !== 'number'
        ) {
          return null;
        }

        return [teamKey, (teamValue as { total: number }).total] as const;
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry)),
  );
};

export function GameHistoryDock({
  roomId,
  gameStarted,
  players = [],
  variant = 'dock',
  showOverview = true,
  summaryOverride = null,
  includeSummaryFetch = true,
  onFiltersChange,
}: GameHistoryDockProps) {
  const t = useTranslations('gameHistoryDock');
  const trumpT = useTranslations('trump');
  const getActionLabel = (actionType: GameHistoryActionType) =>
    t(ACTION_TYPE_MESSAGE_KEYS[actionType] as never);
  const getDetailLabel = (
    key: string,
    values?: Record<string, boolean | number | string>,
  ) => t(`detailLabels.${key}` as never, values as never);
  const [isMinimized, setIsMinimized] = useState(true);
  const [selectedRound, setSelectedRound] = useState<'all' | number>('all');
  const [selectedActionType, setSelectedActionType] = useState<
    'all' | GameHistoryActionType
  >('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<'all' | string>('all');
  const entryLimit = variant === 'page' ? 250 : 25;
  const historyEnabled = variant === 'page' || !isMinimized;
  const replayQuery = useMemo(
    () => ({
      limit: entryLimit,
      roundNumber: selectedRound === 'all' ? undefined : selectedRound,
      actionType:
        selectedActionType === 'all' ? undefined : selectedActionType,
      playerId: selectedPlayerId === 'all' ? undefined : selectedPlayerId,
    }),
    [entryLimit, selectedActionType, selectedPlayerId, selectedRound],
  );
  const { replay, summary, isLoading, error, refresh } = useGameHistory(
    roomId,
    historyEnabled,
    {
      includeSummary: includeSummaryFetch,
      replayQuery,
      summaryQuery: undefined,
    },
  );
  const resolvedSummary = summaryOverride ?? summary;
  const playerNameMap = useMemo(
    () =>
      new Map([
        ...Object.entries(resolvedSummary?.playerNames ?? {}),
        ...players.map((player) => [player.playerId, player.name] as const),
      ]),
    [players, resolvedSummary?.playerNames],
  );

  useEffect(() => {
    setSelectedRound('all');
    setSelectedActionType('all');
    setSelectedPlayerId('all');
  }, [roomId]);

  useEffect(() => {
    onFiltersChange?.({
      round: selectedRound,
      actionType: selectedActionType,
      playerId: selectedPlayerId,
    });
  }, [onFiltersChange, selectedActionType, selectedPlayerId, selectedRound]);

  const orderedRounds = useMemo(() => {
    if (!replay) {
      return [];
    }

    return [...replay.rounds].sort((left, right) => {
      const leftValue = left.roundNumber ?? -1;
      const rightValue = right.roundNumber ?? -1;
      return rightValue - leftValue;
    });
  }, [replay]);

  const displayRounds = useMemo(
    () =>
      variant === 'page'
        ? orderedRounds.filter((round) => round.roundNumber !== null)
        : orderedRounds,
    [orderedRounds, variant],
  );
  const latestRound = orderedRounds[0] ?? null;
  const eventFeed = useMemo(
    () =>
      orderedRounds
        .flatMap((round) =>
          round.events.map((event) => ({
            event,
            roundNumber: round.roundNumber,
          })),
        )
        .sort(
          (left, right) =>
            right.event.timestamp.getTime() - left.event.timestamp.getTime(),
        )
        .slice(0, entryLimit),
    [entryLimit, orderedRounds],
  );
  const roundOptions = useMemo(() => {
    if (!resolvedSummary) {
      return [];
    }

    return [...resolvedSummary.roundNumbers].sort((left, right) => right - left);
  }, [resolvedSummary]);
  const actionBreakdown = useMemo(() => {
    const counts = new Map<GameHistoryActionType, number>();

    for (const round of orderedRounds) {
      for (const actionType of round.actionTypes) {
        counts.set(actionType, (counts.get(actionType) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);
  }, [orderedRounds]);
  const playerOptions = useMemo(
    () => resolvedSummary?.playerIds ?? [],
    [resolvedSummary],
  );
  const roundScoreDeltas = useMemo(() => {
    const deltasByEventId = new Map<string, Record<string, number>>();
    const previousTotals: Record<string, number> = {};

    if (!replay) {
      return deltasByEventId;
    }

    const chronologicalEvents = replay.rounds
      .flatMap((round) => round.events)
      .sort(
        (left, right) =>
          left.timestamp.getTime() - right.timestamp.getTime(),
      );

    for (const event of chronologicalEvents) {
      if (event.actionType !== 'round_completed') {
        continue;
      }

      const scoreDetail = event.detailItems.find(
        (detailItem) => detailItem.value.kind === 'scores',
      );

      if (!scoreDetail || scoreDetail.value.kind !== 'scores') {
        continue;
      }

      const currentTotals = extractScoreTotals(scoreDetail.value.scores);
      const eventDeltas = Object.fromEntries(
        Object.entries(currentTotals).map(([teamKey, total]) => [
          teamKey,
          total - (previousTotals[teamKey] ?? 0),
        ]),
      );

      deltasByEventId.set(event.id, eventDeltas);
      Object.assign(previousTotals, currentTotals);
    }

    return deltasByEventId;
  }, [replay]);
  const visiblePlayerCount = useMemo(
    () =>
      new Set(orderedRounds.flatMap((round) => round.playerIds)).size,
    [orderedRounds],
  );
  const feedWindow = useMemo(() => {
    if (eventFeed.length === 0) {
      return null;
    }

    return {
      latest: eventFeed[0]?.event.timestamp ?? null,
      earliest: eventFeed.at(-1)?.event.timestamp ?? null,
      };
    }, [eventFeed]);
  const hasDisplayEvents =
    variant === 'page' ? displayRounds.length > 0 : eventFeed.length > 0;
  const formattedHistoryWindow = useMemo(() => {
    if (!resolvedSummary?.firstTimestamp || !resolvedSummary.lastTimestamp) {
      return t('unknownTimeWindow');
    }

    return `${resolvedSummary.firstTimestamp.toLocaleString()} - ${resolvedSummary.lastTimestamp.toLocaleString()}`;
  }, [resolvedSummary?.firstTimestamp, resolvedSummary?.lastTimestamp, t]);

  useEffect(() => {
    if (variant === 'dock' && gameStarted) {
      setIsMinimized(true);
    }
  }, [gameStarted, variant]);

  const formatTeam = (team: number | null | undefined) => {
    if (team === null || team === undefined) {
      return null;
    }

    return t('teamValue', { team: team + 1 });
  };

  const formatPlayer = (playerId: string | null | undefined) => {
    if (!playerId) {
      return null;
    }

    return playerNameMap.get(playerId) ?? playerId;
  };

  const formatTrump = (trump: unknown) => {
    if (typeof trump !== 'string' || trump.length === 0) {
      return null;
    }

    return trumpT(trump as never);
  };
  const summaryStatusLabel = !resolvedSummary
    ? t('statusInProgress')
    : resolvedSummary.status === 'completed'
      ? t('statusCompleted')
      : t('statusInProgress');
  const summaryWinnerLabel = !resolvedSummary
    ? t('noWinner')
    : formatTeam(resolvedSummary.winningTeam) ?? t('noWinner');
  const summaryLastActionLabel = !resolvedSummary?.lastActionType
    ? t('noLastAction')
    : getActionLabel(resolvedSummary.lastActionType);

  const formatEventWindow = (
    start: Date | null | undefined,
    end: Date | null | undefined,
  ) =>
    `${start?.toLocaleTimeString() ?? '--:--'} - ${
      end?.toLocaleTimeString() ?? '--:--'
    }`;

  const formatDeclaration = (value: unknown) => {
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }

    const [pairsPart, trumpPart] = value.split(' / ');
    if (!trumpPart) {
      return formatTrump(value) ?? value;
    }
    const maybeTrump =
      trumpPart && trumpPart.length > 0 ? formatTrump(trumpPart) : null;

    return [pairsPart ?? null, maybeTrump].filter(Boolean).join(' / ');
  };

  const formatScores = (
    value: Record<string, unknown> | null,
    roundDeltas?: Record<string, number>,
  ) => {
    if (!value) {
      return null;
    }

    const teamValues = Object.entries(value)
      .map(([teamKey, teamValue]) => {
        if (
          !teamValue ||
          typeof teamValue !== 'object' ||
          typeof (teamValue as { total?: unknown }).total !== 'number'
        ) {
          return null;
        }

        const roundScore =
          roundDeltas && Object.prototype.hasOwnProperty.call(roundDeltas, teamKey)
            ? roundDeltas[teamKey]
            : null;
        const total = (teamValue as { total: number }).total;
        const teamNumber = Number(teamKey);
        const teamLabel = Number.isNaN(teamNumber)
          ? teamKey
          : formatTeam(teamNumber);

        return `${teamLabel ?? teamKey}: ${
          roundScore === null
            ? t('scoreTotalValue', { total })
            : t('scoreValue', { play: roundScore, total })
        }`;
      })
      .filter((entry): entry is string => Boolean(entry));

    if (teamValues.length === 0) {
      return null;
    }

    return teamValues.join(', ');
  };

  const formatDetailValue = (
    detailItem: GameHistoryReplayDetailItem,
    event?: GameHistoryReplayEvent,
  ) => {
    switch (detailItem.value.kind) {
      case 'text':
        if (
          detailItem.labelKey === 'declaration' ||
          detailItem.labelKey === 'highestDeclaration'
        ) {
          return formatDeclaration(detailItem.value.text);
        }
        if (detailItem.labelKey === 'revealBroken') {
          return getDetailLabel(detailItem.value.text);
        }
        return detailItem.value.text;
      case 'player':
        return (
          detailItem.value.playerName ??
          formatPlayer(detailItem.value.playerId) ??
          null
        );
      case 'team':
        return formatTeam(detailItem.value.team);
      case 'trump':
        return formatTrump(detailItem.value.trump);
      case 'number':
        return detailItem.value.value === null
          ? null
          : String(detailItem.value.value);
      case 'cards':
        return detailItem.value.cards.length > 0
          ? detailItem.value.cards.join(', ')
          : null;
      case 'scores':
        return formatScores(
          detailItem.value.scores,
          event?.actionType === 'round_completed'
            ? roundScoreDeltas.get(event.id)
            : undefined,
        );
      default:
        return null;
    }
  };

  const getEventDetails = (event: GameHistoryReplayEvent) =>
    event.detailItems
      .map((detailItem) => {
        const renderedValue = formatDetailValue(detailItem, event);
        if (!renderedValue) {
          return null;
        }

        return `${getDetailLabel(detailItem.labelKey)}: ${renderedValue}`;
      })
      .filter((entry): entry is string => Boolean(entry));

  const getDetailValue = (
    event: GameHistoryReplayEvent,
    labelKey: string,
  ) => {
    const detailItem = event.detailItems.find(
      (item) => item.labelKey === labelKey,
    );

    return detailItem ? formatDetailValue(detailItem, event) : null;
  };

  const formatEventSummary = (event: GameHistoryReplayEvent) => {
    const player = formatPlayer(event.playerId) ?? t('unknownPlayer');

    switch (event.actionType) {
      case 'game_started':
        return t('summaries.game_started' as never, {
          firstBlow: getDetailValue(event, 'firstBlow') ?? t('unknownPlayer'),
          pointsToWin: getDetailValue(event, 'pointsToWin') ?? '-',
        } as never);
      case 'blow_declared':
        return t('summaries.blow_declared' as never, {
          player,
          declaration: getDetailValue(event, 'declaration') ?? t('unknownValue'),
        } as never);
      case 'blow_passed':
        return t('summaries.blow_passed' as never, { player } as never);
      case 'play_phase_started':
        return t('summaries.play_phase_started' as never, {
          player: getDetailValue(event, 'winner') ?? player,
          trump: getDetailValue(event, 'trump') ?? t('unknownValue'),
        } as never);
      case 'card_played':
        return t('summaries.card_played' as never, {
          player,
          card: getDetailValue(event, 'card') ?? t('unknownValue'),
        } as never);
      case 'field_completed':
        return t('summaries.field_completed' as never, {
          winner: getDetailValue(event, 'winner') ?? t('unknownPlayer'),
          team: getDetailValue(event, 'winnerTeam') ?? t('unknownValue'),
        } as never);
      case 'round_completed':
        return t('summaries.round_completed' as never, {
          team: getDetailValue(event, 'declaringTeam') ?? t('unknownValue'),
        } as never);
      case 'round_cancelled':
        return t('summaries.round_cancelled' as never);
      case 'round_reset':
        return t('summaries.round_reset' as never);
      case 'broken_hand_revealed':
        return t('summaries.broken_hand_revealed' as never, {
          player,
          nextPlayer: getDetailValue(event, 'nextPlayer') ?? t('unknownPlayer'),
        } as never);
      case 'game_over':
        return t('summaries.game_over' as never, {
          team: getDetailValue(event, 'winnerTeam') ?? t('unknownValue'),
        } as never);
      case 'player_stats_updated':
        return t('summaries.player_stats_updated' as never, {
          updated: getDetailValue(event, 'updated') ?? '0',
          failed: getDetailValue(event, 'failed') ?? '0',
        } as never);
      default:
        return event.summary;
    }
  };

  const getRoundHighlights = (round: GameHistoryReplayRound) => {
    const highlights = new Set<string>();
    const latestEvent = round.events.at(-1);
    const candidateEvents = [
      [...round.events].reverse().find((event) => event.actionType === 'game_over'),
      [...round.events]
        .reverse()
        .find((event) => event.actionType === 'round_completed'),
      [...round.events]
        .reverse()
        .find((event) => event.actionType === 'round_cancelled'),
      [...round.events]
        .reverse()
        .find((event) => event.actionType === 'field_completed'),
    ].filter((event): event is GameHistoryReplayEvent => Boolean(event));

    for (const event of candidateEvents) {
      for (const detail of getEventDetails(event).slice(0, 2)) {
        highlights.add(detail);
      }
    }

    if (latestEvent) {
      highlights.add(
        `${t('overviewLastAction')}: ${getActionLabel(latestEvent.actionType)}`,
      );
    }

    return [...highlights].slice(0, 4);
  };

  const renderEventList = (
    items: Array<{ event: GameHistoryReplayEvent; roundNumber: number | null }>,
  ) => (
    <ul className={styles.eventList}>
      {items.map(({ event, roundNumber }) => {
        const eventDetails = getEventDetails(event);

        return (
          <li key={event.id} className={styles.eventItem}>
            <div className={styles.eventMetaRow}>
              <div className={styles.eventTimestamp}>
                {event.timestamp.toLocaleTimeString()}
              </div>
              <div className={styles.eventBadges}>
                <span className={styles.eventBadge}>
                  {roundNumber === null
                    ? t('preGame')
                    : t('round', { round: roundNumber })}
                </span>
                <span className={styles.eventBadge}>
                  {getActionLabel(event.actionType)}
                </span>
                {formatPlayer(event.playerId) ? (
                  <span className={styles.eventBadgeMuted}>
                    {formatPlayer(event.playerId)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className={styles.eventSummary}>
              {formatEventSummary(event)}
            </div>
            {eventDetails.length > 0 ? (
              <div className={styles.eventDetails}>
                {eventDetails.map((detail) => (
                  <span key={`${event.id}-${detail}`} className={styles.detailChip}>
                    {detail}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  const renderStartingHand = (round: GameHistoryReplayRound) => {
    const hand = round.viewerStartingHand ?? [];

    return (
      <div className={styles.startingHandPanel}>
        <span className={styles.startingHandLabel}>{t('startingHand')}</span>
        {hand.length > 0 ? (
          <div className={styles.startingHandCards}>
            {hand.map((card, index) => (
              <CardFace
                key={`${round.roundNumber}-${card}-${index}`}
                card={card}
                className={styles.startingHandCard}
              />
            ))}
          </div>
        ) : (
          <span className={styles.startingHandEmpty}>{t('noStartingHand')}</span>
        )}
      </div>
    );
  };

  if (variant === 'dock' && isMinimized) {
    return (
      <div className={styles.minimized}>
        <button
          type="button"
          className={styles.minimizedButton}
          onClick={() => setIsMinimized(false)}
        >
          {t('title')}
          {replay ? ` (${replay.totalEntries})` : ''}
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        variant === 'page'
          ? `${styles.panel} ${styles.panelPage}`
          : styles.panel
      }
    >
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{t('title')}</h3>
          <p className={styles.subtitle}>
            {resolvedSummary
              ? t('summary', {
                  rounds: resolvedSummary.roundNumbers.length,
                  entries: resolvedSummary.totalEntries,
                })
              : gameStarted
                ? t('live')
                : t('waiting')}
          </p>
        </div>
        <div className={styles.actions}>
          {variant === 'dock' ? (
            <Link
              href={`/game-history/${roomId}`}
              className={styles.openPageLink}
            >
              {t('openPage')}
            </Link>
          ) : null}
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            {t('refresh')}
          </button>
          {variant === 'dock' ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setIsMinimized(true)}
            >
              {t('minimize')}
            </button>
          ) : null}
        </div>
      </div>

      {isLoading && !replay ? (
        <div className={styles.state}>{t('loading')}</div>
      ) : error ? (
        <div className={styles.stateError}>{error}</div>
      ) : !hasDisplayEvents ? (
        <div className={styles.state}>{t('empty')}</div>
      ) : (
        <div className={styles.content}>
          {variant === 'page' && showOverview && resolvedSummary ? (
            <>
              <div className={styles.pageOverview}>
                <div className={styles.overviewCard}>
                  <span className={styles.overviewLabel}>{t('overviewStatus')}</span>
                  <span className={styles.overviewValueSmall}>{summaryStatusLabel}</span>
                </div>
                <div className={styles.overviewCard}>
                  <span className={styles.overviewLabel}>{t('overviewWinner')}</span>
                  <span className={styles.overviewValueSmall}>{summaryWinnerLabel}</span>
                </div>
                <div className={styles.overviewCard}>
                  <span className={styles.overviewLabel}>{t('overviewLastAction')}</span>
                  <span className={styles.overviewValueSmall}>{summaryLastActionLabel}</span>
                </div>
                <div className={styles.overviewCard}>
                  <span className={styles.overviewLabel}>{t('overviewEntries')}</span>
                  <span className={styles.overviewValue}>{resolvedSummary.totalEntries}</span>
                </div>
                <div className={styles.overviewCard}>
                  <span className={styles.overviewLabel}>{t('overviewRounds')}</span>
                  <span className={styles.overviewValue}>{resolvedSummary.roundNumbers.length}</span>
                </div>
                <div className={styles.overviewCard}>
                  <span className={styles.overviewLabel}>{t('overviewPlayers')}</span>
                  <span className={styles.overviewValue}>{resolvedSummary.playerIds.length}</span>
                </div>
                <div className={styles.overviewCardWide}>
                  <span className={styles.overviewLabel}>{t('overviewWindow')}</span>
                  <span className={styles.overviewValueSmall}>{formattedHistoryWindow}</span>
                </div>
              </div>
            </>
          ) : null}
          {variant !== 'page' ? (
            <div className={styles.toolbar}>
            <label className={styles.selectLabel}>
              {t('roundFilter')}
              <select
                className={styles.select}
                value={selectedRound}
                onChange={(event) => {
                  const { value } = event.target;
                  setSelectedRound(value === 'all' ? 'all' : Number(value));
                }}
              >
                <option value="all">{t('allRounds')}</option>
                {roundOptions.map((roundNumber) => (
                  <option key={roundNumber} value={roundNumber}>
                    {t('round', { round: roundNumber })}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.selectLabel}>
              {t('actionFilter')}
              <select
                className={styles.select}
                value={selectedActionType}
                onChange={(event) => {
                  const { value } = event.target;
                  setSelectedActionType(
                    value === 'all'
                      ? 'all'
                      : (value as GameHistoryActionType),
                  );
                }}
              >
                <option value="all">{t('allActions')}</option>
                {ACTION_TYPE_OPTIONS.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {getActionLabel(actionType)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.selectLabel}>
              {t('playerFilter')}
              <select
                className={styles.select}
                value={selectedPlayerId}
                onChange={(event) => {
                  const { value } = event.target;
                  setSelectedPlayerId(value === 'all' ? 'all' : value);
                }}
              >
                <option value="all">{t('allPlayers')}</option>
                {playerOptions.map((playerId) => (
                  <option key={playerId} value={playerId}>
                    {formatPlayer(playerId)}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.metrics}>
              <span className={styles.metric}>
                {t('entriesMetric', { count: replay?.totalEntries ?? 0 })}
              </span>
              <span className={styles.metric}>
                {t('playersMetric', {
                  count: visiblePlayerCount,
                })}
              </span>
            </div>
          </div>
          ) : null}
          {variant !== 'page' ? (
            <div className={styles.roundMeta}>
            <span className={styles.roundTitle}>
              {selectedRound === 'all'
                ? t('allRounds')
                : latestRound?.roundNumber === null
                ? t('preGame')
                : t('round', { round: latestRound?.roundNumber ?? selectedRound })}
            </span>
            <span className={styles.roundWindow}>
              {formatEventWindow(feedWindow?.earliest, feedWindow?.latest)}
            </span>
          </div>
          ) : null}
          {variant === 'page' && displayRounds.length > 0 ? (
            <section className={styles.roundSections}>
              <h4 className={styles.breakdownTitle}>{t('roundBreakdown')}</h4>
              <div className={styles.roundSectionList}>
                {displayRounds.map((round, index) => {
                  const chronologicalEvents = [...round.events].sort(
                    (left, right) =>
                      left.timestamp.getTime() - right.timestamp.getTime(),
                  );
                  const roundHighlights = getRoundHighlights(round);
                  const roundSummaryHighlights = roundHighlights.slice(0, 2);
                  const roundWindow = formatEventWindow(
                    round.startedAt ?? chronologicalEvents[0]?.timestamp,
                    round.endedAt ?? chronologicalEvents.at(-1)?.timestamp,
                  );

                  return (
                    <details
                      key={round.roundNumber ?? 'pre-game'}
                      className={styles.roundSection}
                      open={index === 0}
                    >
                      <summary className={styles.roundSectionSummary}>
                        <div className={styles.roundSectionHeading}>
                          <span className={styles.roundSectionTitle}>
                            {round.roundNumber === null
                              ? t('preGame')
                              : t('round', { round: round.roundNumber })}
                          </span>
                          <span className={styles.roundSectionWindow}>
                            {roundWindow}
                          </span>
                        </div>
                        <div className={styles.roundSectionMetrics}>
                          <span className={styles.badge}>
                            {t('entriesMetric', { count: round.entries.length })}
                          </span>
                          <span className={styles.badge}>
                            {t('playersMetric', { count: round.playerIds.length })}
                          </span>
                          {roundSummaryHighlights.map((highlight) => (
                            <span
                              key={`${round.roundNumber}-summary-${highlight}`}
                              className={styles.badge}
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </summary>
                      <div className={styles.roundSectionBody}>
                        {renderStartingHand(round)}
                        {roundHighlights.length > 0 ? (
                          <div className={styles.breakdown}>
                            {roundHighlights.map((highlight) => (
                              <span key={`${round.roundNumber}-${highlight}`} className={styles.badge}>
                                {highlight}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {round.actionTypes.length > 0 ? (
                          <div className={styles.breakdown}>
                            {round.actionTypes.map((actionType) => (
                              <span key={actionType} className={styles.badge}>
                                {getActionLabel(actionType)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {renderEventList(
                          chronologicalEvents.map((event) => ({
                            event,
                            roundNumber: round.roundNumber,
                          })),
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          ) : null}
          {variant !== 'page' && actionBreakdown.length > 0 && (
            <div className={styles.breakdown}>
              {actionBreakdown.map(([actionType, count]) => (
                <span key={actionType} className={styles.badge}>
                  {getActionLabel(actionType)} x{count}
                </span>
              ))}
            </div>
          )}
          {variant !== 'page' ? renderEventList(eventFeed) : null}
        </div>
      )}
    </div>
  );
}
