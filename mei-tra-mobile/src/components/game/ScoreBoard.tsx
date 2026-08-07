import type {
  TeamNames,
  TransportTeamScores,
} from '@meitra/contracts/game';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

const TEAM_COLORS = ['#c0392b', '#2c3e50'] as const;

interface ScoreBoardProps {
  scores: TransportTeamScores;
  pointsToWin: number;
  teamNames?: TeamNames;
}

export function ScoreBoard({
  scores,
  pointsToWin,
  teamNames,
}: ScoreBoardProps) {
  return (
    <View style={styles.container}>
      {([0, 1] as const).map((team) => {
        const name = teamNames?.[team] || `チーム${team + 1}`;
        const score = scores[team]?.total ?? 0;
        const isReach = score >= pointsToWin - 1;
        const width = `${Math.min(100, (score / Math.max(pointsToWin, 1)) * 100)}%` as const;
        const teamColor = TEAM_COLORS[team];

        return (
          <View
            key={team}
            style={[styles.team, { borderLeftColor: teamColor }]}
          >
            <View style={styles.row}>
              <Text numberOfLines={1} style={styles.teamName}>
                {name}
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
    flex: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  team: {
    gap: 4,
    paddingLeft: 10,
    borderLeftWidth: 3,
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
    height: 8,
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
