'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './ScoreCalculator.module.scss';

interface ScoreCalculatorProps {
  data: {
    title: string;
    description: string;
  };
}

export function ScoreCalculator({ data }: ScoreCalculatorProps) {
  const t = useTranslations('tutorial.scoring');
  const [declaredPairs, setDeclaredPairs] = useState<number>(7);
  const [wonFields, setWonFields] = useState<number>(7);

  const calculateScore = (X: number, Y: number): number => {
    if (Y >= X) {
      return 0.5 * (Y - X) + X - 5;
    } else {
      return Y - X;
    }
  };

  const score = calculateScore(declaredPairs, wonFields);
  const isSuccess = wonFields >= declaredPairs;

  const examples = [
    { declared: 6, won: 6, description: t('example1') },
    { declared: 7, won: 8, description: t('example2') },
    { declared: 8, won: 6, description: t('example3') },
    { declared: 9, won: 10, description: t('example4') },
    { declared: 6, won: 10, description: t('example5') },
  ];

  return (
    <div className={styles.scoreCalculator}>
      <h3 className={styles.title}>{data.title}</h3>
      <p className={styles.description}>{data.description}</p>

      <div className={styles.calculatorContent}>
        <div className={styles.inputSection}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {t('declaredPairs')}
              <input
                type="number"
                min="6"
                max="10"
                value={declaredPairs}
                onChange={(e) => setDeclaredPairs(Number(e.target.value))}
                className={styles.input}
              />
            </label>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>
              {t('wonFields')}
              <input
                type="number"
                min="0"
                max="10"
                value={wonFields}
                onChange={(e) => setWonFields(Number(e.target.value))}
                className={styles.input}
              />
            </label>
          </div>
        </div>

        <div className={styles.resultSection}>
          <div className={`${styles.resultCard} ${isSuccess ? styles.success : styles.failure}`}>
            <div className={styles.resultHeader}>
              <span className={styles.resultStatus}>
                {isSuccess ? `✅ ${t('declarationSuccess')}` : `❌ ${t('declarationFailure')}`}
              </span>
              <span className={styles.resultScore}>
                {score > 0 ? '+' : ''}{score}{t('points')}
              </span>
            </div>

            <div className={styles.calculation}>
              <div className={styles.formula}>
                {isSuccess ? (
                  <>
                    <span>{t('whenSuccess')}</span>
                    <span>0.5 × ({wonFields} - {declaredPairs}) + {declaredPairs} - 5</span>
                    <span>= 0.5 × {wonFields - declaredPairs} + {declaredPairs - 5}</span>
                    <span>= {0.5 * (wonFields - declaredPairs)} + {declaredPairs - 5} = <strong>{score}</strong></span>
                  </>
                ) : (
                  <>
                    <span>{t('whenFailure')}</span>
                    <span>{wonFields} - {declaredPairs} = <strong>{score}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.examplesSection}>
          <h4 className={styles.examplesTitle}>{t('examplesTitle')}</h4>
          <div className={styles.examplesList}>
            {examples.map((example, index) => {
              const exampleScore = calculateScore(example.declared, example.won);
              const exampleSuccess = example.won >= example.declared;

              return (
                <div key={index} className={styles.example}>
                  <div className={styles.exampleHeader}>
                    <span className={styles.exampleLabel}>{example.description}</span>
                    <span className={`${styles.exampleScore} ${exampleSuccess ? styles.positive : styles.negative}`}>
                      {exampleScore > 0 ? '+' : ''}{exampleScore}{t('points')}
                    </span>
                  </div>
                  <div className={styles.exampleDetail}>
                    {t('declaration')}{example.declared}{t('pairs')} → {t('acquired')}{example.won}{t('fields')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.tips}>
          <h4 className={styles.tipsTitle}>{t('scoringTips')}</h4>
          <ul className={styles.tipsList}>
            <li>{t('tip1')}</li>
            <li>{t('tip2')}</li>
            <li>{t('tip3')}</li>
            <li>{t('tip4')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}