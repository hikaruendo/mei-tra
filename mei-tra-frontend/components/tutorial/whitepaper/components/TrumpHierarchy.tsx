'use client';

import { useTranslations } from 'next-intl';
import styles from './TrumpHierarchy.module.scss';

interface TrumpHierarchyProps {
  data: {
    title: string;
    trumps: Array<{
      type: string;
      label: string;
      strength: number;
      color: string;
    }>;
  };
}

export function TrumpHierarchy({ data }: TrumpHierarchyProps) {
  const t = useTranslations('tutorial.blow');

  return (
    <div className={styles.trumpHierarchy}>
      <h3 className={styles.title}>{data.title}</h3>

      <div className={styles.simpleList}>
        {data.trumps.map((trump, index) => (
          <div key={trump.type} className={styles.trumpRow}>
            <span className={styles.strength}>{trump.strength}</span>
            <span
              className={styles.trumpName}
              style={{ color: trump.color }}
            >
              {trump.label}
            </span>
            {index < data.trumps.length - 1 && (
              <span className={styles.separator}>&gt;</span>
            )}
          </div>
        ))}
      </div>

      <p className={styles.note}>
        {t('hierarchyNote')}
      </p>
    </div>
  );
}