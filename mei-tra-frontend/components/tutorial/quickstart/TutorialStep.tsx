'use client';

import { ReactNode } from 'react';
import styles from './TutorialStep.module.scss';

interface TutorialStepProps {
  stepNumber: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  isActive?: boolean;
  isCompleted?: boolean;
}

export function TutorialStep({
  stepNumber,
  title,
  subtitle,
  children,
  isActive = false,
  isCompleted = false
}: TutorialStepProps) {
  return (
    <div className={`${styles.stepContainer} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}>
      <div className={styles.stepHeader}>
        <div className={styles.stepBadge}>
          <span className={styles.stepNumber}>{stepNumber}</span>
          {isCompleted && (
            <svg className={styles.checkIcon} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className={styles.stepTitleSection}>
          <h2 className={styles.stepTitle}>{title}</h2>
          {subtitle && <p className={styles.stepSubtitle}>{subtitle}</p>}
        </div>
      </div>

      <div className={styles.stepContent}>
        {children}
      </div>
    </div>
  );
}