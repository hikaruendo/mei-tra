import type { RoundSettlement, TeamNames } from '@meitra/contracts/game';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { getTeamDisplayName } from '@/lib/team-labels';
import { colors } from '@/theme/colors';

interface Props {
  settlement: RoundSettlement;
  teamNames?: TeamNames;
}

export function RoundSettlementPanel({ settlement, teamNames }: Props) {
  const teamLabel = (team: 0 | 1) => getTeamDisplayName(team, teamNames);
  const isPlayResult = settlement.kind === 'play' || settlement.kind === 'open';

  return (
    <View style={styles.panel} testID="round-settlement">
      <Text style={styles.title}>
        {t('board.result.title', { round: settlement.roundNumber })}
      </Text>
      {settlement.pointsAwarded > 0 ? (
        <Text style={styles.scoreLine} testID="round-score-line">
          {t('board.result.scoreLine', {
            team: teamLabel(settlement.awardedTeam),
            gain: settlement.pointsAwarded,
          })}
        </Text>
      ) : null}
      {isPlayResult ? (
        <View style={styles.breakdown}>
          <Text style={styles.text}>
            {t('board.result.declaration', {
              declared: settlement.declaredPairs,
              won: settlement.wonFields,
            })}
          </Text>
          {settlement.kind === 'open' && settlement.awardedUnplayedFields > 0 ? (
            <Text style={styles.text}>
              {t('board.result.openFields', {
                played: settlement.playedFieldsWon,
                remaining: settlement.awardedUnplayedFields,
                total: settlement.wonFields,
              })}
            </Text>
          ) : null}
          <Text style={styles.formula}>
            {settlement.calculatedPoints >= 0
              ? t('board.result.successFormula', {
                  declared: settlement.declaredPairs,
                  won: settlement.wonFields,
                  points: settlement.calculatedPoints,
                })
              : t('board.result.failedFormula', {
                  declared: settlement.declaredPairs,
                  won: settlement.wonFields,
                  points: settlement.calculatedPoints,
                })}
          </Text>
        </View>
      ) : (
        <Text style={styles.formula}>{t(`board.result.${settlement.kind}`)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    gap: 7,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.panelStrong,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 5,
  },
  scoreLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  breakdown: {
    gap: 5,
    marginTop: 7,
  },
  formula: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 7,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});
