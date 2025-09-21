'use client';

import styles from './ProgressBar.module.scss';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

export function ProgressBar({ currentStep, totalSteps, stepTitles }: ProgressBarProps) {
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressHeader}>
        <span className={styles.progressText}>
          Step {currentStep} of {totalSteps}
        </span>
        <span className={styles.stepTitle}>
          {stepTitles[currentStep - 1]}
        </span>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercentage}%` }}
        />
        <div className={styles.stepIndicators}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <div
              key={index}
              className={`${styles.stepIndicator} ${
                index + 1 <= currentStep ? styles.completed : ''
              } ${index + 1 === currentStep ? styles.current : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}