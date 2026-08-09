import type { PlayerContract, TeamNames } from '@meitra/contracts/game';
import type {
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

interface GameHistoryProps {
  replay: GameHistoryReplayViewContract | null;
  summary: GameHistorySummaryContract | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  players?: PlayerContract[];
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
          <Text style={styles.inProgress}>進行中</Text>
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="small" />
        <Text style={styles.loadingText}>ログを読み込み中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={onRefresh}>
          <Text style={styles.retryText}>再試行</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={onRefresh}>
          <Text style={styles.refresh}>更新</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>表示できる対局ログがありません</Text>
        </View>
      ) : (
        <>
          <View style={[styles.row, styles.headRow]}>
            <Text numberOfLines={1} style={[styles.headCell, { flex: COL.round }]}>
              ラウンド
            </Text>
            <Text numberOfLines={1} style={[styles.headCell, { flex: COL.blower }]}>
              吹き手
            </Text>
            <Text numberOfLines={1} style={[styles.headCell, { flex: COL.bid }]}>
              宣言
            </Text>
            <Text numberOfLines={1} style={[styles.headCell, { flex: COL.score }]}>
              得点
            </Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {rows.map((row, index) => (
              <Row index={index} key={row.roundNumber} row={row} />
            ))}
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
});
