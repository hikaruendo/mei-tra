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
  'wrong-open',
];

const violationLabelKeys = {
  'negri-forget': 'negriForget',
  'wrong-suit': 'wrongSuit',
  'four-jack': 'fourJack',
  'last-tanzen': 'lastTanzen',
  'wrong-open': 'wrongOpen',
} as const satisfies Record<ChomboViolationType, string>;

interface ChomboReportPanelProps {
  players: Player[];
  currentSeatId: string | null;
  onReport: (violatorSeatId: string, violationType: ChomboViolationType) => void;
}

export function getChomboReportTargets(players: Player[], currentSeatId: string | null): Player[] {
  return players.filter((player) => player.seatId !== currentSeatId && !player.isCOM);
}

export function ChomboReportPanel({ players, currentSeatId, onReport }: ChomboReportPanelProps) {
  const t = useTranslations('chomboReport');
  const opponents = getChomboReportTargets(players, currentSeatId);
  const [violatorSeatId, setViolatorSeatId] = useState<string>(opponents[0]?.seatId ?? '');
  const [violationType, setViolationType] = useState<ChomboViolationType>('negri-forget');

  if (opponents.length === 0) return null;

  return (
    <form
      className={styles.panel}
      aria-label={t('title')}
      onSubmit={(event) => {
        event.preventDefault();
        if (violatorSeatId) onReport(violatorSeatId, violationType);
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>{t('player')}</span>
        <select className={styles.select} value={violatorSeatId} onChange={(event) => setViolatorSeatId(event.target.value)}>
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
