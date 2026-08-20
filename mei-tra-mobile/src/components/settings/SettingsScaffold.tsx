import { type PropsWithChildren, type ReactNode, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';

interface SettingsScaffoldProps extends PropsWithChildren {
  title: string;
  onBack: () => void;
}

interface SettingsCardProps extends PropsWithChildren {
  title?: string;
  description?: string;
  action?: ReactNode;
}

interface SettingsLinkRowProps {
  label: string;
  description?: string;
  onPress: () => void;
}

export function SettingsScaffold({
  children,
  title,
  onBack,
}: SettingsScaffoldProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [title]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <BrandHeader subtitle={title} />
            <Button
              accessibilityLabel={t('settings.back')}
              onPress={onBack}
              style={styles.backButton}
              variant="ghost"
            >
              {t('settings.back')}
            </Button>
          </View>
          {children}
        </View>
      </ScrollView>
    </Screen>
  );
}

export function SettingsCard({
  children,
  title,
  description,
  action,
}: SettingsCardProps) {
  return (
    <View style={styles.card}>
      {title || action ? (
        <View style={styles.cardHeader}>
          <View style={styles.cardHeading}>
            {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
            {description ? (
              <Text style={styles.cardDescription}>{description}</Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SettingsLinkRow({
  label,
  description,
  onPress,
}: SettingsLinkRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <View style={styles.linkCopy}>
        <Text style={styles.linkLabel}>{label}</Text>
        {description ? (
          <Text style={styles.linkDescription}>{description}</Text>
        ) : null}
      </View>
      <Text accessibilityElementsHidden style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 40,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    minHeight: 42,
    paddingHorizontal: 12,
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeading: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: colors.gold,
    fontSize: 19,
    fontWeight: '800',
  },
  cardDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  linkRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panelStrong,
  },
  linkCopy: {
    flex: 1,
    gap: 3,
  },
  linkLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  linkDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: colors.gold,
    fontSize: 28,
    lineHeight: 28,
  },
  pressed: {
    opacity: 0.72,
  },
});
