'use client';

import styles from './StepNavigation.module.scss';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onStepComplete?: () => void;
  isStepComplete?: boolean;
  nextStepLabel?: string;
  previousStepLabel?: string;
}

export function StepNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onStepComplete,
  isStepComplete = false,
  nextStepLabel = "Next Step",
  previousStepLabel = "Previous"
}: StepNavigationProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className={styles.navigationContainer}>
      <div className={styles.navigationContent}>
        {/* Previous Button */}
        <button
          className={`${styles.navButton} ${styles.previous}`}
          onClick={onPrevious}
          disabled={isFirstStep}
        >
          <svg className={styles.buttonIcon} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {previousStepLabel}
        </button>

        {/* Step Progress */}
        <div className={styles.stepInfo}>
          <span className={styles.stepCounter}>
            {currentStep} / {totalSteps}
          </span>
        </div>

        {/* Next/Complete Button */}
        {isLastStep ? (
          <button
            className={`${styles.navButton} ${styles.complete}`}
            onClick={onStepComplete}
          >
            Complete Tutorial
            <svg className={styles.buttonIcon} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <button
            className={`${styles.navButton} ${styles.next} ${isStepComplete ? styles.ready : ''}`}
            onClick={onNext}
            disabled={!isStepComplete}
          >
            {nextStepLabel}
            <svg className={styles.buttonIcon} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}