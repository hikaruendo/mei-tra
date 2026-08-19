import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { t } from '@/i18n';

interface FeedbackBannerProps {
  error?: string | null;
  notice?: string | null;
  onDismiss: () => void;
}

export function FeedbackBanner({
  error,
  notice,
  onDismiss,
}: FeedbackBannerProps) {
  const message = error ?? notice;
  if (!message) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.container, error ? styles.error : styles.notice]}
    >
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityLabel={t('a11y.dismissMessage')}
        accessibilityHint={t('a11y.dismissMessageHint')}
        accessibilityRole="button"
        hitSlop={12}
        onPress={onDismiss}
      >
        <Text style={styles.close}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    backgroundColor: colors.danger,
  },
  notice: {
    backgroundColor: colors.panelStrong,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  close: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 25,
  },
});
