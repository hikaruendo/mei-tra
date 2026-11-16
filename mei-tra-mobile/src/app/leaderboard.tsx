import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { GAME_MODES, type GameMode } from '@meitra/contracts/room';
import {
  describeLeaderboardStanding,
  LEADERBOARD_MODE_LABEL_KEYS,
} from '@meitra/game-client/leaderboard-standing';
import { SettingsScaffold } from '@/components/settings/SettingsScaffold';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';

export default function LeaderboardScreen() {
  useLocale();
  const router = useRouter();
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const [mode, setMode] = useState<GameMode>('normal');
  const { leaderboard, isLoading, hasError } = useLeaderboard(mode, user?.id, getAccessToken);
  const standing = leaderboard && describeLeaderboardStanding(leaderboard, Boolean(user?.isAnonymous));

  if (!authLoading && !user) return <Redirect href="/sign-in" />;

  return <SettingsScaffold onBack={() => router.replace('/settings')} title={t('leaderboard.title')}>
    <View style={styles.body}>
      <View style={styles.tabs}>
        {GAME_MODES.map((value) => <Button key={value} style={styles.tab} variant={mode === value ? 'primary' : 'secondary'} onPress={() => setMode(value)}>{t(`leaderboard.${LEADERBOARD_MODE_LABEL_KEYS[value]}`)}</Button>)}
      </View>
      {isLoading || authLoading ? <ActivityIndicator accessibilityLabel={t('leaderboard.loading')} color={colors.gold} />
        : hasError || !leaderboard ? <Text style={styles.message}>{t('leaderboard.error')}</Text>
        : <>
          <Text style={styles.hint}>{t('leaderboard.hint', { minimumGames: leaderboard.minimumGames })}</Text>
          {standing && <Text style={styles.progress}>{t(`leaderboard.${standing.key}`, standing.values)}</Text>}
          {leaderboard.entries.length ? leaderboard.entries.map((entry) => <View key={entry.userId} style={styles.row}>
            <Text style={styles.rank}>{entry.rank}</Text>
            {entry.avatarUrl ? <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.initial}>{entry.displayName.charAt(0)}</Text></View>}
            <Text style={styles.name}>{entry.displayName}</Text>
            <View style={styles.score}><Text style={styles.rate}>{entry.winRate.toFixed(1)}%</Text><Text style={styles.record}>{t('leaderboard.record', { wins: entry.gamesWon, games: entry.gamesPlayed })}</Text></View>
          </View>) : <Text style={styles.message}>{t('leaderboard.empty')}</Text>}
        </>}
    </View>
  </SettingsScaffold>;
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  hint: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1 },
  progress: { backgroundColor: colors.panelStrong, color: colors.text, padding: 14, borderRadius: 10, fontSize: 15 },
  message: { color: colors.textMuted, fontSize: 16, paddingVertical: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12 },
  rank: { color: colors.text, fontSize: 18, fontWeight: '700', width: 28, textAlign: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelStrong, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.text, fontSize: 17 },
  name: { color: colors.text, flex: 1, fontSize: 16, flexShrink: 1 },
  score: { alignItems: 'flex-end', maxWidth: '40%' },
  rate: { color: colors.text, fontSize: 16, fontWeight: '700' },
  record: { color: colors.textMuted, fontSize: 12, textAlign: 'right' },
});
