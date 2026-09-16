import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { t } from '@/i18n';
import type { NoticeMessage, NoticeSeverity } from '@/context/GameContext';
import type { FeedbackMessage } from '@/types/feedback';

interface FeedbackBannerProps {
  error?: FeedbackMessage | null;
  notice?: NoticeMessage | null;
  onDismiss: () => void;
}

function resolve(message: NoticeMessage): string {
  return typeof message === 'string' ? message : t(message.key, message.params);
}

function severityOf(message: NoticeMessage): NoticeSeverity | undefined {
  return typeof message === 'string' ? undefined : message.severity;
}

export function FeedbackBanner({
  error,
  notice,
  onDismiss,
}: FeedbackBannerProps) {
  const message = error ?? notice;
  if (!message) return null;

  // Like the web notification, a severity tints the text and the border rather
  // than filling the banner; only the error slot keeps a solid danger fill.
  const severity = error ? undefined : severityOf(message);
  const tint =
    severity === 'success'
      ? styles.noticeSuccess
      : severity === 'error'
        ? styles.noticeError
        : null;
  const tintText =
    severity === 'success'
      ? styles.successText
      : severity === 'error'
        ? styles.errorText
        : null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.container, error ? styles.error : styles.notice, tint]}
    >
      <Text style={[styles.message, tintText]}>{resolve(message)}</Text>
      <Pressable
        accessibilityLabel={t('a11y.dismissMessage')}
        accessibilityHint={t('a11y.dismissMessageHint')}
        accessibilityRole="button"
        hitSlop={12}
        onPress={onDismiss}
      >
        <Text style={[styles.close, tintText]}>×</Text>
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
  noticeSuccess: {
    borderWidth: 2,
    borderColor: colors.success,
  },
  noticeError: {
    borderWidth: 2,
    borderColor: colors.danger,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  successText: {
    color: colors.success,
  },
  errorText: {
    color: colors.dangerText,
  },
  close: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 25,
  },
});
