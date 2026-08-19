import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors } from '@/theme/colors';
import type { ConnectionStatus } from '@/types/game';
import { t } from '@/i18n';

interface ConnectionBannerProps {
  status: ConnectionStatus | string;
  onRetry?: () => void;
  retryLabel?: string;
}

const getCopy = (status: ConnectionStatus | string) => {
  switch (status) {
    case 'connected':
      return { label: t('connection.connected'), tone: 'connected' as const };
    case 'resyncing':
      return { label: t('connection.resyncing'), tone: 'pending' as const };
    case 'disconnected':
      return { label: t('connection.offline'), tone: 'offline' as const };
    default:
      return { label: t('connection.reconnecting'), tone: 'pending' as const };
  }
};

export function ConnectionBanner({
  status,
  onRetry,
  retryLabel = t('connection.retry'),
}: ConnectionBannerProps) {
  const copy = getCopy(status);

  return (
    <View
      accessibilityLabel={copy.label}
      accessibilityRole="summary"
      style={[styles.container, styles[copy.tone]]}
    >
      <View style={[styles.dot, styles[`${copy.tone}Dot` as const]]} />
      <Text style={styles.label}>{copy.label}</Text>
      {copy.tone !== 'connected' && onRetry ? (
        <Button
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={styles.retry}
          variant="ghost"
        >
          {retryLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  connected: {
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  pending: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSubtle,
  },
  offline: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSubtle,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  connectedDot: {
    backgroundColor: colors.success,
  },
  pendingDot: {
    backgroundColor: colors.gold,
  },
  offlineDot: {
    backgroundColor: colors.danger,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  retry: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
});
