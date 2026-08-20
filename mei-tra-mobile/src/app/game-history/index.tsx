import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { GameHistoryItems } from '@/components/game-history/GameHistoryItems';
import {
  SettingsCard,
  SettingsScaffold,
} from '@/components/settings/SettingsScaffold';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useProfileGameHistory } from '@/hooks/useProfileGameHistory';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';

export default function GameHistoryIndexScreen() {
  useLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { items, loading: historyLoading, error, refresh } =
    useProfileGameHistory(user?.id ?? null);

  if (!loading && !user) {
    return <Redirect href="/sign-in" />;
  }

  if (loading || !user) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.loading}>{t('rooms.loadingAccount')}</Text>
      </Screen>
    );
  }

  return (
    <SettingsScaffold
      onBack={() => router.replace('/settings')}
      title={t('settings.gameHistory')}
    >
      <SettingsCard
        action={
          <Button
            disabled={historyLoading}
            onPress={() => void refresh()}
            style={styles.refreshButton}
            variant="ghost"
          >
            {t('settings.refresh')}
          </Button>
        }
        description={t('settings.recentGamesHint')}
      >
        <GameHistoryItems
          error={error}
          items={items}
          loading={historyLoading}
        />
      </SettingsCard>
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loading: {
    color: colors.textMuted,
    fontSize: 16,
  },
  refreshButton: {
    minHeight: 40,
    paddingHorizontal: 10,
  },
});
