import { useState } from 'react';
import type { Player } from '@/types/game.types';
import type { ChomboViolationType } from '@contracts/game';
import styles from './ChomboReportPanel.module.scss';

const violationTypes: ChomboViolationType[] = [
  'negri-forget',
  'wrong-suit',
  'four-jack',
  'last-tanzen',
  'wrong-broken',
  'wrong-open',
];

interface ChomboReportPanelProps {
  players: Player[];
  currentSeatId: string | null;
  onReport: (violatorSeatId: string, violationType: ChomboViolationType) => void;
  onReveal?: () => void;
}

export function ChomboReportPanel({ players, currentSeatId, onReport, onReveal }: ChomboReportPanelProps) {
  const opponents = players.filter((player) => player.seatId !== currentSeatId && !player.isCOM);
  const [violatorSeatId, setViolatorSeatId] = useState<string>(opponents[0]?.seatId ?? '');
  const [violationType, setViolationType] = useState<ChomboViolationType>('negri-forget');

  if (opponents.length === 0) return null;

  return (
    <form
      className={styles.panel}
      aria-label="Chombo report"
      onSubmit={(event) => {
        event.preventDefault();
        if (violatorSeatId) onReport(violatorSeatId, violationType);
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>Player</span>
        <select className={styles.select} value={violatorSeatId} onChange={(event) => setViolatorSeatId(event.target.value)}>
          {opponents.map((player) => <option key={player.seatId} value={player.seatId}>{player.name}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Violation</span>
        <select className={styles.select} value={violationType} onChange={(event) => setViolationType(event.target.value as ChomboViolationType)}>
          {violationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <button className={styles.button} type="submit">Report chombo</button>
      {onReveal && <button className={styles.button} type="button" onClick={onReveal}>Reveal my hand</button>}
    </form>
  );
}
