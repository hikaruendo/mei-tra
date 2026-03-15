import React from 'react';
import { Team } from '../../types/game.types';
import styles from './index.module.scss';

interface PlayerIdentityChipProps {
  name: string;
  team: Team;
  size?: 'default' | 'compact';
  className?: string;
}

export const PlayerIdentityChip: React.FC<PlayerIdentityChipProps> = ({
  name,
  team,
  size = 'default',
  className = '',
}) => {
  return (
    <div className={`${styles.chip} ${styles[size]} ${className}`}>
      <span
        className={`${styles.teamDot} ${styles[`team${team}` as keyof typeof styles]}`}
      />
      <span className={styles.label}>{name}</span>
    </div>
  );
};
