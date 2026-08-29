import type {
  TeamNames,
  TransportTeamScores,
} from '@meitra/contracts/game';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { getTeamDisplayName } from '@/lib/team-labels';
import { colors, teamColors } from '@/theme/colors';

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
  const target = Math.max(pointsToWin, 1);
  const renderTeam = (team: 0 | 1) => {
    const name = getTeamDisplayName(team, teamNames);
    const score = scores[team]?.total ?? 0;
    const isReach = score === target - 1 && score < target;
    const teamColor = teamColors[team];

    return (
      <View
        key={team}
        style={styles.team}
        testID={`scoreboard-team-${team}`}
      >
        <View style={styles.identity}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[styles.teamDot, { backgroundColor: teamColor }]}
          />
          <Text numberOfLines={1} style={styles.teamName}>
            {name}
          </Text>
        </View>
        <View style={styles.scoreLine}>
          <Text
            style={[styles.score, isReach && styles.reachScore]}
            testID={`scoreboard-score-${team}`}
          >
            {score}
          </Text>
          {isReach ? (
            <Text
              numberOfLines={1}
              style={styles.reachStatus}
              testID={`scoreboard-status-${team}`}
            >
              {t('scoreboard.onePointToWin')}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View
      accessibilityLabel={t('scoreboard.accessibilityLabel', {
        team0: getTeamDisplayName(0, teamNames),
        score0: scores[0]?.total ?? 0,
        team1: getTeamDisplayName(1, teamNames),
        score1: scores[1]?.total ?? 0,
        target,
      })}
      accessible
      style={styles.container}
      testID="scoreboard"
    >
      {renderTeam(0)}
      <View style={styles.target} testID="scoreboard-target">
        <Text style={styles.targetText} testID="scoreboard-target-text">
          {t('scoreboard.firstTo', { points: target })}
        </Text>
      </View>
      {renderTeam(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  team: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  identity: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  teamDot: {
    width: 7,
    height: 7,
    flexShrink: 0,
    borderRadius: 4,
  },
  teamName: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  score: {
    marginTop: 5,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 27,
  },
  reachScore: {
    color: colors.gold,
  },
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  reachStatus: {
    marginTop: 5,
    color: colors.gold,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  target: {
    flexShrink: 0,
    marginHorizontal: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.panelStrong,
  },
  targetText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
});
