'use client';

import styles from './ExampleCard.module.scss';

interface ExampleCardProps {
  example: {
    scenario: string;
    cards?: string[];
    declaration?: string;
    explanation: string;
  };
}

export function ExampleCard({ example }: ExampleCardProps) {
  return (
    <div className={styles.exampleCard}>
      <div className={styles.scenario}>
        <span className={styles.scenarioLabel}>シナリオ:</span>
        <span className={styles.scenarioText}>{example.scenario}</span>
      </div>

      {example.cards && example.cards.length > 0 && (
        <div className={styles.cards}>
          {example.cards.map((card, index) => (
            <span key={index} className={styles.card}>
              {card}
            </span>
          ))}
        </div>
      )}

      {example.declaration && (
        <div className={styles.declaration}>
          <span className={styles.declarationLabel}>宣言:</span>
          <span className={styles.declarationValue}>{example.declaration}</span>
        </div>
      )}

      <div className={styles.explanation}>
        {example.explanation}
      </div>
    </div>
  );
}