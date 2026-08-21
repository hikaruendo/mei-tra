import { Redirect, useRouter } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';

import {
  SettingsCard,
  SettingsLinkRow,
  SettingsScaffold,
} from '@/components/settings/SettingsScaffold';
import { Button } from '@/components/ui/Button';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';

export default function SettingsScreen() {
  useLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { connectionStatus, refreshRooms } = useGame();

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

  const displayName =
    user.profile?.displayName ||
    user.profile?.username ||
    user.email?.split('@')[0] ||
    'Player';

  return (
    <SettingsScaffold
      onBack={() => router.replace('/rooms')}
      title={t('settings.profile')}
    >
      {connectionStatus !== 'connected' ? (
        <ConnectionBanner status={connectionStatus} onRetry={refreshRooms} />
      ) : null}

      <SettingsCard>
        <View style={styles.profileSummary}>
          {user.profile?.avatarUrl ? (
            <Image
              source={{ uri: user.profile.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.profileCopy}>
            <Text numberOfLines={2} style={styles.name}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={styles.email}>
              {user.isAnonymous
                ? t('settings.guestAccount')
                : user.email ?? t('settings.noEmail')}
            </Text>
          </View>
        </View>
        <Button onPress={() => router.push('/settings/profile')} variant="secondary">
          {t('settings.editProfile')}
        </Button>
        {user.isAnonymous ? (
          <Button onPress={() => router.push('/upgrade-account')}>
            {t('settings.upgradeCta')}
          </Button>
        ) : null}
      </SettingsCard>

      <SettingsCard title={t('settings.settingsAndSupport')}>
        <SettingsLinkRow
          description={t('settings.historyMenuHint')}
          label={t('settings.gameHistory')}
          onPress={() => router.push('/game-history')}
        />
        <SettingsLinkRow
          description={t('settings.preferencesHint')}
          label={t('settings.preferences')}
          onPress={() => router.push('/settings/preferences')}
        />
        <SettingsLinkRow
          description={t('settings.helpHint')}
          label={t('settings.help')}
          onPress={() => router.push('/settings/help')}
        />
        <SettingsLinkRow
          description={t('settings.accountManagementHint')}
          label={t('settings.accountManagement')}
          onPress={() => router.push('/settings/account')}
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
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '800',
  },
  email: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
