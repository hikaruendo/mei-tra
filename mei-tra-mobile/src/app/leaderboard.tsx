import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LeaderboardMode, LeaderboardResponse } from '@meitra/contracts/leaderboard';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { fetchLeaderboard } from '@/lib/leaderboard-api';
import { colors } from '@/theme/colors';

export default function LeaderboardScreen() {
  useLocale();
  const router = useRouter();
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const [mode, setMode] = useState<LeaderboardMode>('normal');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    setError(false);
    setData(null);
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('No session');
        const result = await fetchLeaderboard(mode, token);
        if (active) setData(result);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [getAccessToken, mode, user?.id]);

  if (!authLoading && !user) return <Redirect href="/sign-in" />;

  return <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <Button variant="ghost" style={styles.back} onPress={() => router.replace('/rooms')}>← {t('rooms.joinable')}</Button>
      <Text style={styles.title}>{t('leaderboard.title')}</Text>
      <Text style={styles.hint}>{t('leaderboard.hint')}</Text>
      <View style={styles.tabs}>
        <Button style={styles.tab} variant={mode === 'normal' ? 'primary' : 'secondary'} onPress={() => setMode('normal')}>{t('leaderboard.modeNormal')}</Button>
        <Button style={styles.tab} variant={mode === 'pro' ? 'primary' : 'secondary'} onPress={() => setMode('pro')}>{t('leaderboard.modePro')}</Button>
      </View>
      {loading || authLoading ? <ActivityIndicator accessibilityLabel={t('leaderboard.loading')} color={colors.gold} />
        : error ? <Text style={styles.message}>{t('leaderboard.error')}</Text>
        : <>
          <Text style={styles.progress}>{user?.isAnonymous ? (data?.me?.gamesPlayed ?? 0) >= 10
            ? t('leaderboard.guestNote')
            : t('leaderboard.guestProgress', { games: data?.me?.gamesPlayed ?? 0, remaining: 10 - (data?.me?.gamesPlayed ?? 0) })
            : data?.me?.rank
            ? t('leaderboard.myRank', { rank: data.me.rank, wins: data.me.gamesWon, games: data.me.gamesPlayed })
            : t('leaderboard.progress', { games: data?.me?.gamesPlayed ?? 0, remaining: Math.max(0, 10 - (data?.me?.gamesPlayed ?? 0)) })}</Text>
          {data?.entries.length ? data.entries.map((entry) => <View key={entry.userId} style={styles.row}>
            <Text style={styles.rank}>{entry.rank}</Text>
            {entry.avatarUrl ? <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.initial}>{entry.displayName.charAt(0)}</Text></View>}
            <Text style={styles.name}>{entry.displayName}</Text>
            <View style={styles.score}><Text style={styles.rate}>{entry.winRate.toFixed(1)}%</Text><Text style={styles.record}>{t('leaderboard.record', { wins: entry.gamesWon, games: entry.gamesPlayed })}</Text></View>
          </View>) : <Text style={styles.message}>{t('leaderboard.empty')}</Text>}
        </>}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  back: { alignSelf: 'flex-start', minHeight: 40 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
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
