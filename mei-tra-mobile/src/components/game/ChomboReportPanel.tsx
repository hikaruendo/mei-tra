import type { ChomboViolationType } from '@meitra/contracts/game';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';

const violationTypes: ChomboViolationType[] = [
  'negri-forget', 'wrong-suit', 'four-jack', 'last-tanzen', 'wrong-open',
];

const violationLabelKeys: Record<ChomboViolationType, string> = {
  'negri-forget': 'chomboReport.negriForget',
  'wrong-suit': 'chomboReport.wrongSuit',
  'four-jack': 'chomboReport.fourJack',
  'last-tanzen': 'chomboReport.lastTanzen',
  'wrong-open': 'chomboReport.wrongOpen',
};

/**
 * A report is irreversible and moves the score, so a tap only proposes it.
 * Mirrors confirmGuestSignOut: react-native-web ships Alert as a no-op stub,
 * so the web build falls back to the browser's confirm dialog.
 */
function confirmReport(
  playerName: string,
  violationLabel: string,
  onConfirm: () => void,
): void {
  const title = t('chomboReport.confirmTitle');
  const message = t('chomboReport.confirmMessage', {
    name: playerName,
    violation: violationLabel,
  });

  if (Platform.OS === 'web') {
    const confirm = (
      globalThis as { confirm?: (message: string) => boolean }
    ).confirm;
    if (confirm?.(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('chomboReport.confirm'), style: 'destructive', onPress: onConfirm },
  ]);
}

interface Props {
  players: { seatId: string; name: string }[];
  onReport: (seatId: string, type: ChomboViolationType) => void;
}

export function ChomboReportPanel({ players, onReport }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('chomboReport.title')}</Text>
      {players.map((player) => (
        <View key={player.seatId} style={styles.row}>
          <Text style={styles.target}>{player.name}</Text>
          {violationTypes.map((type) => (
            <Pressable
              key={type}
              onPress={() =>
                confirmReport(player.name, t(violationLabelKeys[type]), () =>
                  onReport(player.seatId, type),
                )
              }
              style={styles.button}
              testID={`chombo-report-${player.seatId}-${type}`}
            >
              <Text style={styles.buttonText}>{t(violationLabelKeys[type])}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 6, marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: colors.panel },
  title: { color: colors.gold, fontSize: 13, fontWeight: '800' },
  row: { gap: 4 },
  target: { color: colors.text, fontSize: 12, fontWeight: '700' },
  button: { paddingVertical: 4, paddingHorizontal: 6, borderRadius: 5, backgroundColor: colors.panelStrong },
  buttonText: { color: colors.textMuted, fontSize: 10 },
});
