import type { RoundSettlement } from '@contracts/game';
import { useTranslations } from 'next-intl';
import type { TeamNames } from '@/types/game.types';
import { getTeamDisplayName } from '@/lib/utils/teamLabels';
import styles from './index.module.scss';

interface Props {
  settlement: RoundSettlement;
  teamNames?: TeamNames;
}

export function RoundSettlementPanel({ settlement, teamNames }: Props) {
  const t = useTranslations('game.roundResult');
  const teamLabel = (team: 0 | 1) =>
    getTeamDisplayName(team, teamNames, (value) =>
      t(value === 0 ? 'teamRed' : 'teamBlack'),
    );
  const isPlayResult = settlement.kind === 'play' || settlement.kind === 'open';

  return (
    <section className={styles.panel} aria-label={t('title', { round: settlement.roundNumber })}>
      <h2 className={styles.title}>{t('title', { round: settlement.roundNumber })}</h2>
      {settlement.pointsAwarded > 0 ? (
        <p className={styles.scoreLine} data-testid="round-score-line">
          {t('scoreLine', {
            team: teamLabel(settlement.awardedTeam),
            gain: settlement.pointsAwarded,
          })}
        </p>
      ) : null}
      {isPlayResult ? (
        <div className={styles.breakdown}>
          <p>{t('declaration', { declared: settlement.declaredPairs, won: settlement.wonFields })}</p>
          {settlement.kind === 'open' && settlement.awardedUnplayedFields > 0 ? (
            <p>{t('openFields', {
              played: settlement.playedFieldsWon,
              remaining: settlement.awardedUnplayedFields,
              total: settlement.wonFields,
            })}</p>
          ) : null}
          <p className={styles.formula}>
            {settlement.calculatedPoints >= 0
              ? t('successFormula', {
                  declared: settlement.declaredPairs,
                  won: settlement.wonFields,
                  points: settlement.calculatedPoints,
                })
              : t('failedFormula', {
                  declared: settlement.declaredPairs,
                  won: settlement.wonFields,
                  points: settlement.calculatedPoints,
                })}
          </p>
        </div>
      ) : (
        <p className={styles.formula}>{t(settlement.kind)}</p>
      )}
    </section>
  );
}
