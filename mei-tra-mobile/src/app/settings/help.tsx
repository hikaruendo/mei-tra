import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import {
  SettingsCard,
  SettingsScaffold,
} from '@/components/settings/SettingsScaffold';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { config } from '@/lib/config';
import { colors } from '@/theme/colors';

export default function HelpSettingsScreen() {
  useLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [openingLink, setOpeningLink] = useState<string | null>(null);

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

  const links = [
    {
      label: t('settings.privacyPolicy'),
      url: `${config.publicWebBaseUrl}/ja/privacy`,
    },
    {
      label: t('settings.terms'),
      url: `${config.publicWebBaseUrl}/ja/terms`,
    },
    { label: t('settings.support'), url: config.supportUrl },
  ];

  const handleOpenLink = async (url: string, label: string) => {
    if (openingLink) return;
    setOpeningLink(url);
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(t('settings.linkOpenFailed', { label }));
    } finally {
      setOpeningLink(null);
    }
  };

  return (
    <SettingsScaffold
      onBack={() => router.replace('/settings')}
      title={t('settings.help')}
    >
      <SettingsCard
        description={t('settings.legalHint')}
        title={t('settings.legal')}
      >
        {links.map(({ label, url }) => (
          <Pressable
            accessibilityHint={t('settings.openInBrowser')}
            accessibilityLabel={t('settings.openLabel', { label })}
            accessibilityRole="link"
            accessibilityState={{ disabled: Boolean(openingLink) }}
            disabled={Boolean(openingLink)}
            key={url}
            onPress={() => void handleOpenLink(url, label)}
            style={({ pressed }) => [
              styles.link,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.linkLabel}>
              {openingLink === url
                ? t('settings.openingLabel', { label })
                : label}
            </Text>
            <Text accessibilityElementsHidden style={styles.chevron}>
              ↗
            </Text>
          </Pressable>
        ))}
        {linkError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {linkError}
          </Text>
        ) : null}
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
  link: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panelStrong,
  },
  linkLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  chevron: {
    color: colors.gold,
    fontSize: 18,
  },
  pressed: {
    opacity: 0.72,
  },
  error: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
});
