'use client';

import styles from './TipCard.module.scss';

interface TipCardProps {
  tips: {
    title: string;
    tips: string[];
  };
}

export function TipCard({ tips }: TipCardProps) {
  return (
    <div className={styles.tipCard}>
      <h3 className={styles.tipTitle}>
        <span className={styles.tipIcon}>💡</span>
        {tips.title}
      </h3>
      <ul className={styles.tipList}>
        {tips.tips.map((tip, index) => (
          <li key={index} className={styles.tipItem}>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}