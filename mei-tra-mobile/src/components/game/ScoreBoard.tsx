import type {
  PlayerContract,
  TransportTeamScores,
} from '@meitra/contracts/game';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface ScoreBoardProps {
  players: PlayerContract[];
  scores: TransportTeamScores;
  pointsToWin: number;
}

export function ScoreBoard({
  players,
  scores,
  pointsToWin,
}: ScoreBoardProps) {
  return (
    <View style={styles.container}>
      {[0, 1].map((team) => {
        const names = players
          .filter((player) => player.team === team)
          .map((player) => player.name)
          .join('・');
        const score = scores[team]?.total ?? 0;
        const isReach = score >= pointsToWin - 1;
        const width = `${Math.min(100, (score / Math.max(pointsToWin, 1)) * 100)}%` as const;

        return (
          <View key={team} style={styles.team}>
            <View style={styles.row}>
              <Text numberOfLines={1} style={styles.teamName}>
                {names || `チーム${team + 1}`}
              </Text>
              <Text style={[styles.score, isReach && styles.reach]}>
                {score}/{pointsToWin}
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width },
                  isReach && styles.reachFill,
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundElevated,
  },
  team: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  score: {
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  reach: {
    color: colors.gold,
  },
  track: {
    height: 10,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: colors.panel,
  },
  fill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.textMuted,
  },
  reachFill: {
    backgroundColor: colors.gold,
  },
});
