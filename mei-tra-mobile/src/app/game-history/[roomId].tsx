import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GameHistory } from '@/components/game/GameHistory';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useGameHistory } from '@/hooks/useGameHistory';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';

export default function GameHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomId?: string | string[] }>();
  const { user, loading: authLoading } = useAuth();
  const roomId = Array.isArray(params.roomId)
    ? params.roomId[0]
    : params.roomId;
  const { replay, summary, loading, error, refresh } = useGameHistory(
    roomId ?? null,
    Boolean(user && roomId),
  );

  if (!authLoading && !user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <BrandHeader subtitle={t('gameLog.subtitle')} />
        <Button onPress={() => router.back()} style={styles.back} variant="ghost">
          {t('gameLog.back')}
        </Button>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>{t('gameLog.title')}</Text>
        <GameHistory
          error={error}
          loading={loading || authLoading}
          onRefresh={() => void refresh()}
          replay={replay}
          summary={summary}
          teamNames={summary?.teamNames}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  back: {
    minHeight: 42,
    paddingHorizontal: 12,
  },
  card: {
    flex: 1,
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  title: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
  },
});
