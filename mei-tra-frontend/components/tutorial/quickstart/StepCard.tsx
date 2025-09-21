'use client';

import { ReactNode } from 'react';
import styles from './StepCard.module.scss';

interface StepCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: 'default' | 'interactive' | 'example' | 'highlight' | 'concept' | 'practice' | 'tip';
  icon?: ReactNode;
}

export function StepCard({
  title,
  description,
  children,
  variant = 'default',
  icon
}: StepCardProps) {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.cardHeader}>
        {icon && <div className={styles.cardIcon}>{icon}</div>}
        <div className={styles.cardTitleSection}>
          <h3 className={styles.cardTitle}>{title}</h3>
          {description && <p className={styles.cardDescription}>{description}</p>}
        </div>
      </div>

      <div className={styles.cardContent}>
        {children}
      </div>
    </div>
  );
}