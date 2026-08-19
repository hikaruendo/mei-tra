import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/colors';
import { t } from '@/i18n';

interface ButtonProps
  extends PropsWithChildren,
    Omit<PressableProps, 'children' | 'style'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isBusy = Boolean(loading);
  const isDisabled = Boolean(disabled || isBusy);
  const activityColor = variant === 'primary' ? colors.cardText : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator accessibilityLabel={t('a11y.processing')} color={activityColor} />
      ) : (
        <Text style={[styles.label, variant === 'primary' && styles.primaryLabel]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  secondary: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryLabel: {
    color: colors.cardText,
  },
});
