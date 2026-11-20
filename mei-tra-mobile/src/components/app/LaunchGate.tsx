import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useLaunchStatus } from '@/hooks/useLaunchStatus';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export function LaunchGate({ children }: PropsWithChildren) {
  const status = useLaunchStatus();

  if (status.kind === 'ready') {
    return children;
  }

  return (
    <Screen contentStyle={styles.content}>
      <BrandHeader />
      {status.kind === 'store-update' ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {t('appUpdate.title')}
          </Text>
          <Text style={styles.message}>{t('appUpdate.message')}</Text>
          {status.storeUrl ? (
            <Button
              onPress={() => {
                if (status.storeUrl) void Linking.openURL(status.storeUrl);
              }}
            >
              {t(Platform.OS === 'ios' ? 'appUpdate.openAppStore' : 'appUpdate.openPlayStore')}
            </Button>
          ) : null}
        </>
      ) : status.kind === 'downloading' ? (
        <View style={styles.progressBlock}>
          <Text style={styles.message}>
            {t('appUpdate.downloading', { progress: status.progress })}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: status.progress }}
            style={styles.track}
          >
            <View style={[styles.fill, { width: `${status.progress}%` }]} />
          </View>
        </View>
      ) : (
        <View style={styles.progressBlock}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.message}>{t('appUpdate.checking')}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.size.base,
    textAlign: 'center',
  },
  progressBlock: {
    gap: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.panelStrong,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
});
