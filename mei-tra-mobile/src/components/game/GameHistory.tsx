import type { TeamNames } from '@meitra/contracts/game';
import type {
  GameHistoryReplayEventContract,
  GameHistoryReplayViewContract,
  GameHistorySummaryContract,
} from '@meitra/contracts/game-history';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { buildRoundTableRows, type RoundRow } from '@/lib/game-log-rows';
import { colors, teamColors } from '@/theme/colors';
import type { MobilePlayer } from '@/types/game';
import { MiniCard } from '@/components/game/MiniCard';
import { t } from '@/i18n';

interface GameHistoryProps {
  replay: GameHistoryReplayViewContract | null;
  summary: GameHistorySummaryContract | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  players?: MobilePlayer[];
  teamNames?: TeamNames;
}

/**
 * Column weights, tuned so the "ラウンド" heading fits on one line down to 320pt
 * (it needs ~44pt at 11px). It was 0.8, which left ~34pt and wrapped it to two
 * lines. The cell itself only ever holds a one or two digit number, so the
 * heading is what sets this column's width.
 */
const COL = {
  round: 1.3,
  blower: 1.8,
  bid: 2.3,
  score: 2.0,
} as const;

function Row({ row, index }: { row: RoundRow; index: number }) {
  return (
    <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
      <Text style={[styles.cell, styles.roundCell, { flex: COL.round }]}>
        {row.roundNumber}
      </Text>
      <Text numberOfLines={1} style={[styles.cell, { flex: COL.blower }]}>
        {row.blower}
      </Text>
      <Text numberOfLines={2} style={[styles.cell, { flex: COL.bid }]}>
        {row.bid}
      </Text>
      <View style={[styles.scoreCell, { flex: COL.score }]}>
        {row.inProgress ? (
          <Text style={styles.inProgress}>{t('gameLog.inProgress')}</Text>
        ) : (
          row.scores.map((score) => (
            <Text key={score.team} style={styles.scoreLine}>
              <Text style={{ color: teamColors[score.team] }}>
                {score.label}
              </Text>
              <Text style={styles.scoreValue}> {score.delta}</Text>
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

function getEventPlayerName(event: GameHistoryReplayEventContract): string {
  const playerDetail = event.detailItems.find(
    (detail) => detail.labelKey === 'player' && detail.value.kind === 'player',
  );
  if (playerDetail?.value.kind === 'player' && playerDetail.value.playerName) {
    return playerDetail.value.playerName;
  }

  const playerNames = event.actionData.playerNames;
  if (
    event.actorSeatId &&
    typeof playerNames === 'object' &&
    playerNames !== null &&
    !Array.isArray(playerNames)
  ) {
    const playerName = (playerNames as Record<string, unknown>)[
      event.actorSeatId
    ];
    if (typeof playerName === 'string' && playerName.length > 0) {
      return playerName;
    }
  }

  return t('common.player');
}

function MembershipRow({ event }: { event: GameHistoryReplayEventContract }) {
  const playerName = getEventPlayerName(event);
  const actionLabel =
    event.actionType === 'player_joined'
      ? t('gameLog.joined')
      : t('gameLog.left');

  return (
    <View style={styles.membershipRow}>
      <Text style={styles.membershipTime}>
        {new Date(event.timestamp).toLocaleTimeString()}
      </Text>
      <Text style={styles.membershipText}>
        {t('gameLog.membershipEntry', {
          name: playerName,
          action: actionLabel,
        })}
      </Text>
    </View>
  );
}

export function GameHistory({
  replay,
  summary,
  loading,
  error,
  onRefresh,
  players,
  teamNames,
}: GameHistoryProps) {
  const rows = useMemo(
    () => buildRoundTableRows(replay, players ?? [], teamNames),
    [replay, players, teamNames],
  );
  const membershipEvents = useMemo(
    () =>
      (replay?.rounds ?? [])
        .flatMap((round) => round.events)
        .filter(
          (event) =>
            event.actionType === 'player_joined' ||
            event.actionType === 'player_left',
        )
        .sort(
          (left, right) =>
            Date.parse(left.timestamp) - Date.parse(right.timestamp),
        ),
    [replay],
  );
  const startingHands = useMemo(
    () =>
      (replay?.rounds ?? []).filter(
        (round) => (round.viewerStartingHand?.length ?? 0) > 0,
      ),
    [replay],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="small" />
        <Text style={styles.loadingText}>{t('gameLog.loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={onRefresh}>
          <Text style={styles.retryText}>{t('gameLog.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={onRefresh}>
          <Text style={styles.refresh}>{t('gameLog.refresh')}</Text>
        </Pressable>
      </View>

      {rows.length === 0 && membershipEvents.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('gameLog.empty')}</Text>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false}>
            {membershipEvents.length > 0 ? (
              <View style={styles.membershipSection}>
                <Text style={styles.membershipTitle}>{t('gameLog.membership')}</Text>
                {membershipEvents.map((event) => (
                  <MembershipRow event={event} key={event.id} />
                ))}
              </View>
            ) : null}
            {rows.length > 0 ? (
              <>
                <View style={[styles.row, styles.headRow]}>
                  <Text numberOfLines={1} style={[styles.headCell, { flex: COL.round }]}>
                    {t('gameLog.round')}
                  </Text>
                  <Text numberOfLines={1} style={[styles.headCell, { flex: COL.blower }]}>
                    {t('gameLog.blower')}
                  </Text>
                  <Text numberOfLines={1} style={[styles.headCell, { flex: COL.bid }]}>
                    {t('gameLog.declaration')}
                  </Text>
                  <Text numberOfLines={1} style={[styles.headCell, { flex: COL.score }]}>
                    {t('gameLog.score')}
                  </Text>
                </View>
                {rows.map((row, index) => (
                  <Row index={index} key={row.roundNumber} row={row} />
                ))}
              </>
            ) : null}
            {startingHands.length > 0 ? (
              <View style={styles.handsSection}>
                <Text style={styles.handsTitle}>{t('gameLog.startingHands')}</Text>
                {startingHands.map((round) => (
                  <View
                    key={`starting-hand-${round.roundNumber ?? 'pre-game'}`}
                    style={styles.handRow}
                  >
                    <Text style={styles.handLabel}>
                      {round.roundNumber == null
                        ? t('gameLog.preGame')
                        : t('gameLog.roundN', { n: round.roundNumber })}
                    </Text>
                    <View style={styles.handCards}>
                      {round.viewerStartingHand?.map((card, index) => (
                        <MiniCard
                          card={card}
                          key={`${round.roundNumber ?? 'pre-game'}-${card}-${index}`}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  refresh: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowAlt: {
    backgroundColor: colors.panelStrong,
  },
  headRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  headCell: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  cell: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  roundCell: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  scoreCell: {
    gap: 2,
  },
  scoreLine: {
    fontSize: 12,
    fontWeight: '700',
  },
  scoreValue: {
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  membershipSection: {
    gap: 6,
    paddingBottom: 8,
  },
  membershipTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  membershipTime: {
    color: colors.textMuted,
    fontSize: 11,
    minWidth: 72,
  },
  membershipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  inProgress: {
    color: colors.textMuted,
    fontSize: 12,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 13,
    textAlign: 'center',
  },
  retryText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  handsSection: {
    gap: 12,
    paddingTop: 18,
  },
  handsTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '800',
  },
  handRow: {
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.panelStrong,
  },
  handLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  handCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
