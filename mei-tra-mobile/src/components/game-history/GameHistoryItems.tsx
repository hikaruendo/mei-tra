import type { Team } from '@meitra/contracts/game';
import type { RecentGameHistoryItemContract } from '@meitra/contracts/game-history';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getLocaleTag, t } from '@/i18n';
import { getTeamDisplayName } from '@/lib/team-labels';
import { colors } from '@/theme/colors';

interface GameHistoryItemsProps {
  items: RecentGameHistoryItemContract[];
  loading: boolean;
  error: string | null;
}

export function GameHistoryItems({
  items,
  loading,
  error,
}: GameHistoryItemsProps) {
  const router = useRouter();

  if (loading && items.length === 0) {
    return <Text style={styles.status}>{t('settings.historyLoading')}</Text>;
  }

  if (!loading && error) {
    return (
      <Text accessibilityRole="alert" style={styles.error}>
        {t('settings.historyFailed')}
      </Text>
    );
  }

  if (!loading && items.length === 0) {
    return <Text style={styles.status}>{t('settings.historyEmpty')}</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((match) => {
        const completedAt = new Date(match.completedAt);
        const winner =
          match.winningTeam === 0 || match.winningTeam === 1
            ? getTeamDisplayName(
                match.winningTeam as Team,
                match.teamNames,
              )
            : t('settings.winnerUndecided');

        return (
          <Pressable
            accessibilityHint={t('settings.historyHint')}
            accessibilityRole="button"
            key={match.roomId}
            onPress={() =>
              router.push({
                pathname: '/game-history/[roomId]',
                params: { roomId: match.roomId },
              })
            }
            style={({ pressed }) => [
              styles.item,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.itemHeader}>
              <Text numberOfLines={1} style={styles.roomName}>
                {match.roomName}
              </Text>
              <Text style={styles.date}>
                {Number.isNaN(completedAt.getTime())
                  ? match.completedAt
                  : completedAt.toLocaleString(getLocaleTag())}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                {t('settings.rounds', { count: match.roundCount })}
              </Text>
              <Text style={styles.metaText}>
                {t('settings.winner', { name: winner })}
              </Text>
            </View>
            <Text style={styles.details}>{t('settings.viewDetails')}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  status: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
  item: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panelStrong,
  },
  itemHeader: {
    gap: 4,
  },
  roomName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaText: {
    color: colors.text,
    fontSize: 13,
  },
  details: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
