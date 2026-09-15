import type { ChomboViolationType } from '@meitra/contracts/game';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

const violationTypes: ChomboViolationType[] = [
  'negri-forget', 'wrong-suit', 'four-jack', 'last-tanzen', 'wrong-open',
];

interface Props {
  players: { seatId: string; name: string }[];
  onReport: (seatId: string, type: ChomboViolationType) => void;
}

export function ChomboReportPanel({ players, onReport }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Chombo report</Text>
      {players.map((player) => (
        <View key={player.seatId} style={styles.row}>
          <Text style={styles.target}>{player.name}</Text>
          {violationTypes.map((type) => (
            <Pressable key={type} onPress={() => onReport(player.seatId, type)} style={styles.button}>
              <Text style={styles.buttonText}>{type}</Text>
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
