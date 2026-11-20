import { type PropsWithChildren, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { t } from '@/i18n';
import { subscribeAppLifecycle } from '@/lib/app-lifecycle';
import {
  fetchMinimumVersion,
  getInstalledVersion,
  isOlderThan,
  storeUrls,
  type StorePlatform,
} from '@/lib/app-version';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type GateState = 'checking' | 'ok' | 'update-required';

const storePlatform: StorePlatform | null =
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;

async function checkVersion(platform: StorePlatform): Promise<GateState> {
  const installed = getInstalledVersion();
  const minimum = await fetchMinimumVersion(platform);
  return installed && minimum && isOlderThan(installed, minimum)
    ? 'update-required'
    : 'ok';
}

/**
 * Holds the app back, before anyone signs in or rejoins a room, until the
 * installed build meets the minimum version. Checked again on every return to
 * the foreground so an open app cannot resume on an outdated build.
 */
export function UpdateRequiredGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<GateState>(storePlatform ? 'checking' : 'ok');

  useEffect(() => {
    if (!storePlatform) return;
    const platform = storePlatform;
    let active = true;
    const run = () => {
      void checkVersion(platform).then((next) => {
        if (active) setState(next);
      });
    };

    run();
    const unsubscribe = subscribeAppLifecycle((snapshot, previous) => {
      if (snapshot.appState === 'active' && previous.appState !== 'active') run();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (state === 'checking') {
    return <View style={styles.blank} />;
  }

  if (state === 'update-required' && storePlatform) {
    const platform = storePlatform;
    return (
      <Screen contentStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('appUpdate.title')}
        </Text>
        <Text style={styles.message}>{t('appUpdate.message')}</Text>
        <Button
          onPress={() => {
            void Linking.openURL(storeUrls[platform]);
          }}
        >
          {t(platform === 'ios' ? 'appUpdate.openAppStore' : 'appUpdate.openPlayStore')}
        </Button>
      </Screen>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
});
