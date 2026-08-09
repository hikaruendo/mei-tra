import type {
  GameHistoryActionType,
  GameHistoryReplayEventContract,
  GameHistoryReplayViewContract,
  GameHistorySummaryContract,
} from '@meitra/contracts/game-history';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';

const ACTION_LABELS: Record<GameHistoryActionType, string> = {
  game_started: '開始',
  blow_declared: '宣言',
  blow_passed: 'パス',
  play_phase_started: 'プレイ開始',
  card_played: 'カード',
  field_completed: 'ペア獲得',
  round_completed: 'ラウンド終了',
  round_cancelled: 'ラウンド中止',
  round_reset: 'ラウンドリセット',
  broken_hand_revealed: '役なし公開',
  game_over: 'ゲーム終了',
  player_stats_updated: '成績更新',
};

interface GameHistoryProps {
  replay: GameHistoryReplayViewContract | null;
  summary: GameHistorySummaryContract | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function EventRow({ event }: { event: GameHistoryReplayEventContract }) {
  const time = new Date(event.timestamp).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return (
    <View style={styles.eventRow}>
      <Text style={styles.eventTime}>{time}</Text>
      <View style={styles.eventBadge}>
        <Text style={styles.eventBadgeText}>
          {ACTION_LABELS[event.actionType]}
        </Text>
      </View>
      <Text numberOfLines={2} style={styles.eventSummary}>
        {event.summary}
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
}: GameHistoryProps) {
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="small" />
        <Text style={styles.loadingText}>履歴を読み込み中</Text>
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

  if (!replay || !summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>履歴はまだありません</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>ゲーム概要</Text>
        <Text style={styles.summaryText}>
          {summary.status === 'completed' ? '終了' : '進行中'}
          {summary.winningTeam != null
            ? ` — 勝者: チーム${summary.winningTeam + 1}`
            : ''}
        </Text>
        <Text style={styles.summaryText}>
          ラウンド数: {summary.roundNumbers.length} / アクション数:{' '}
          {summary.totalEntries}
        </Text>
      </View>

      {replay.rounds.map((round, index) => {
        const roundLabel = round.roundNumber
          ? `ラウンド ${round.roundNumber}`
          : `ラウンド ${index + 1}`;
        const isExpanded = expandedRound === index;
        return (
          <View key={index} style={styles.roundCard}>
            <Pressable
              onPress={() => setExpandedRound(isExpanded ? null : index)}
              style={styles.roundHeader}
            >
              <Text style={styles.roundTitle}>
                {isExpanded ? '▼' : '▶'} {roundLabel}
              </Text>
              <Text style={styles.roundCount}>
                {round.events.length}件
              </Text>
            </Pressable>
            {isExpanded ? (
              <View style={styles.eventList}>
                {round.events.map((event) => (
                  <EventRow event={event} key={event.id} />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 14,
    paddingBottom: 40,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  retryText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  summaryCard: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  summaryTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryText: {
    color: colors.text,
    fontSize: 14,
  },
  roundCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  roundTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  roundCount: {
    color: colors.textMuted,
    fontSize: 13,
  },
  eventList: {
    gap: 2,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  eventTime: {
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.backgroundElevated,
  },
  eventBadgeText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
  },
  eventSummary: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
});
