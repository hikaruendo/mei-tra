import type { ChomboViolationType } from '@meitra/contracts/game';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { t } from '@/i18n';

const scenarios: { type: ChomboViolationType; key: string }[] = [
  { type: 'negri-forget', key: 'negriForget' },
  { type: 'wrong-suit', key: 'wrongSuit' },
  { type: 'four-jack', key: 'fourJack' },
  { type: 'last-tanzen', key: 'lastTanzen' },
  { type: 'wrong-open', key: 'wrongOpen' },
];

interface Props {
  onSelect: (violationType: ChomboViolationType) => void;
}

/** Development-only shortcuts, same as the web dock (ChomboScenarioPanel.tsx). */
export function ChomboScenarioPanel({ onSelect }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('chomboScenario.title')}</Text>
      <Text style={styles.description}>{t('chomboScenario.description')}</Text>
      {scenarios.map(({ type, key }) => (
        <Pressable
          accessibilityRole="button"
          key={type}
          onPress={() => onSelect(type)}
          style={({ pressed }) => [styles.scenario, pressed && styles.pressed]}
          testID={`chombo-scenario-${type}`}
        >
          <Text style={styles.label}>{t(`chomboScenario.${key}`)}</Text>
          <Text style={styles.hint}>{t(`chomboScenario.${key}Hint`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  scenario: {
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.7,
  },
});
