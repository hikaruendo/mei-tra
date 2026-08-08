import React from 'react';
import styles from './index.module.scss';

interface PlayerIdentityChipProps {
  name: string;
  size?: 'default' | 'compact';
  align?: 'left' | 'center';
  className?: string;
}

export const PlayerIdentityChip: React.FC<PlayerIdentityChipProps> = ({
  name,
  size = 'default',
  align = 'left',
  className = '',
}) => {
  return (
    <div
      className={`${styles.chip} ${styles[size]} ${styles[align]} ${className}`}
      title={name}
    >
      <span className={styles.label}>{name}</span>
    </div>
  );
};
