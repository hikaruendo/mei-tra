import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Player } from '@/types/game.types';
import type { ChomboViolationType } from '@contracts/game';
import styles from './ChomboReportPanel.module.scss';

const violationTypes: ChomboViolationType[] = [
  'negri-forget',
  'wrong-suit',
  'four-jack',
  'last-tanzen',
];

const violationLabelKeys = {
  'negri-forget': 'negriForget',
  'wrong-suit': 'wrongSuit',
  'four-jack': 'fourJack',
  'last-tanzen': 'lastTanzen',
} as const satisfies Record<ChomboViolationType, string>;

interface ChomboReportPanelProps {
  players: Player[];
  currentSeatId: string | null;
  onReport: (violatorSeatId: string, violationType: ChomboViolationType) => void;
}

/** The server takes reports only against the other team, and COM seats record no violations. */
export function getChomboReportTargets(players: Player[], currentSeatId: string | null): Player[] {
  const reporter = players.find((player) => player.seatId === currentSeatId);
  if (!reporter) return [];
  return players.filter((player) => player.team !== reporter.team && !player.isCOM);
}

export function ChomboReportPanel({ players, currentSeatId, onReport }: ChomboReportPanelProps) {
  const t = useTranslations('chomboReport');
  const opponents = getChomboReportTargets(players, currentSeatId);
  const [chosenSeatId, setChosenSeatId] = useState<string | null>(null);
  const [violationType, setViolationType] = useState<ChomboViolationType>('negri-forget');
  // The list can change while the panel is open (a seat turns COM, a player
  // joins), so the form falls back to the first player on the list.
  const violator = opponents.find((player) => player.seatId === chosenSeatId) ?? opponents[0];

  if (!violator) {
    return (
      <section className={styles.panel} aria-label={t('title')}>
        <p className={styles.empty}>{t('noTargets')}</p>
      </section>
    );
  }

  return (
    <form
      className={styles.panel}
      aria-label={t('title')}
      onSubmit={(event) => {
        event.preventDefault();
        onReport(violator.seatId, violationType);
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>{t('player')}</span>
        <select className={styles.select} value={violator.seatId} onChange={(event) => setChosenSeatId(event.target.value)}>
          {opponents.map((player) => <option key={player.seatId} value={player.seatId}>{player.name}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{t('violation')}</span>
        <select className={styles.select} value={violationType} onChange={(event) => setViolationType(event.target.value as ChomboViolationType)}>
          {violationTypes.map((type) => <option key={type} value={type}>{t(violationLabelKeys[type])}</option>)}
        </select>
      </label>
      <button className={styles.button} type="submit">{t('submit')}</button>
    </form>
  );
}
