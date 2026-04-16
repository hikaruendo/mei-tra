import React from 'react';
import styles from './index.module.scss';

interface PlayerIdentityChipProps {
  name: string;
  size?: 'default' | 'compact';
  className?: string;
}

export const PlayerIdentityChip: React.FC<PlayerIdentityChipProps> = ({
  name,
  size = 'default',
  className = '',
}) => {
  return (
    <div className={`${styles.chip} ${styles[size]} ${className}`}>
      <span className={styles.label}>{name}</span>
    </div>
  );
};
