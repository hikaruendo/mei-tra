import { useUpdates } from 'expo-updates';
import { type PropsWithChildren, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
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
import { installLatestBundle } from '@/lib/ota-update';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type LaunchState = 'checking' | 'downloading' | 'store-update' | 'ready';

const storePlatform: StorePlatform | null =
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;

async function needsStoreUpdate(platform: StorePlatform): Promise<boolean> {
  const installed = getInstalledVersion();
  const minimum = await fetchMinimumVersion(platform);
  return Boolean(installed && minimum && isOlderThan(installed, minimum));
}

/**
 * Like a game's title screen: before the top page opens, an outdated binary is
 * sent to the store and newer data is downloaded and restarted into. The same
 * checks run on every return to the foreground, so nobody resumes on old code.
 */
export function LaunchGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<LaunchState>(
    storePlatform ? 'checking' : 'ready',
  );
  const { downloadProgress } = useUpdates();

  useEffect(() => {
    if (!storePlatform) return;
    const platform = storePlatform;
    let active = true;
    let running = false;
    const update = (next: LaunchState) => {
      if (active) setState(next);
    };

    const run = async () => {
      if (running) return;
      running = true;
      try {
        if (await needsStoreUpdate(platform)) {
          update('store-update');
          return;
        }
        const result = await installLatestBundle(() => update('downloading'));
        if (result === 'up-to-date') update('ready');
      } finally {
        running = false;
      }
    };

    void run();
    const unsubscribe = subscribeAppLifecycle((snapshot, previous) => {
      if (snapshot.appState === 'active' && previous.appState !== 'active') {
        void run();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (state === 'ready') {
    return children;
  }

  if (state === 'store-update' && storePlatform) {
    const platform = storePlatform;
    return (
      <Screen contentStyle={styles.content}>
        <BrandHeader />
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

  const progress = Math.round((downloadProgress ?? 0) * 100);
  return (
    <Screen contentStyle={styles.content}>
      <BrandHeader />
      {state === 'downloading' ? (
        <View style={styles.progressBlock}>
          <Text style={styles.message}>
            {t('appUpdate.downloading', { progress })}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={styles.track}
          >
            <View style={[styles.fill, { width: `${progress}%` }]} />
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
    alignItems: 'stretch',
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
    alignItems: 'stretch',
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
