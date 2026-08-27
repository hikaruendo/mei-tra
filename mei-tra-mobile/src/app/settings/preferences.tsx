import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  SettingsCard,
  SettingsScaffold,
} from '@/components/settings/SettingsScaffold';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { updateProfile } from '@/lib/profile-api';
import { colors } from '@/theme/colors';

const LOCALE_OPTIONS = [
  { value: 'system' as const, labelKey: 'settings.languageSystem' },
  { value: 'ja' as const, labelKey: 'settings.languageJa' },
  { value: 'en' as const, labelKey: 'settings.languageEn' },
];

export default function PreferencesSettingsScreen() {
  const router = useRouter();
  const { user, loading, getAccessToken, refreshProfile } = useAuth();
  const { preference: localePreference, setPreference: setLocalePreference } =
    useLocale();
  const [savingAnimation, setSavingAnimation] = useState(false);
  const [savingSound, setSavingSound] = useState(false);
  const [animationOverride, setAnimationOverride] = useState<boolean | null>(
    null,
  );
  const [soundOverride, setSoundOverride] = useState<boolean | null>(null);
  const [settingError, setSettingError] = useState<string | null>(null);

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

  const startPlayerAnimation =
    animationOverride ?? user.profile?.startPlayerAnimation ?? true;
  const soundEffects = soundOverride ?? user.profile?.sound ?? true;

  const handleToggleAnimation = async (next: boolean) => {
    setSavingAnimation(true);
    setSettingError(null);
    setAnimationOverride(next);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await updateProfile(user.id, token, {
        preferences: { startPlayerAnimation: next },
      });
      await refreshProfile();
      setAnimationOverride(null);
    } catch (error) {
      setAnimationOverride(null);
      setSettingError(
        error instanceof Error
          ? error.message
          : t('settings.settingUpdateFailed'),
      );
    } finally {
      setSavingAnimation(false);
    }
  };

  const handleToggleSound = async (next: boolean) => {
    setSavingSound(true);
    setSettingError(null);
    setSoundOverride(next);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await updateProfile(user.id, token, {
        preferences: { sound: next },
      });
      await refreshProfile();
      setSoundOverride(null);
    } catch (error) {
      setSoundOverride(null);
      setSettingError(
        error instanceof Error
          ? error.message
          : t('settings.settingUpdateFailed'),
      );
    } finally {
      setSavingSound(false);
    }
  };

  return (
    <SettingsScaffold
      onBack={() => router.replace('/settings')}
      title={t('settings.preferences')}
    >
      <SettingsCard title={t('settings.game')}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('settings.jankenToggle')}</Text>
          <Switch
            disabled={savingAnimation}
            onValueChange={(value) => void handleToggleAnimation(value)}
            value={startPlayerAnimation}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('settings.soundEffects')}</Text>
          <Switch
            disabled={savingSound}
            onValueChange={(value) => void handleToggleSound(value)}
            value={soundEffects}
          />
        </View>
        {settingError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {settingError}
          </Text>
        ) : null}
      </SettingsCard>

      <SettingsCard title={t('settings.language')}>
        {LOCALE_OPTIONS.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: localePreference === option.value }}
            key={option.value}
            onPress={() => void setLocalePreference(option.value)}
            style={({ pressed }) => [
              styles.localeOption,
              localePreference === option.value && styles.localeOptionActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.localeOptionLabel}>{t(option.labelKey)}</Text>
            {localePreference === option.value ? (
              <Text style={styles.localeOptionCheck}>✓</Text>
            ) : null}
          </Pressable>
        ))}
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
  localeOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  localeOptionActive: {
    borderColor: colors.gold,
  },
  localeOptionLabel: {
    color: colors.text,
    fontSize: 16,
  },
  localeOptionCheck: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
