'use client';

import { useState } from 'react';
import styles from './ScoreCalculator.module.scss';

interface ScoreCalculatorProps {
  data: {
    title: string;
    description: string;
  };
}

export function ScoreCalculator({ data }: ScoreCalculatorProps) {
  const [declaredPairs, setDeclaredPairs] = useState<number>(7);
  const [wonFields, setWonFields] = useState<number>(7);

  // スコア計算ロジック（コードベースから）
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
    { declared: 6, won: 6, description: '宣言達成（最低ライン）' },
    { declared: 7, won: 8, description: '宣言超過（ボーナス）' },
    { declared: 8, won: 6, description: '宣言失敗（ペナルティ）' },
    { declared: 9, won: 10, description: '高宣言成功' },
    { declared: 6, won: 10, description: '低宣言で全フィールド獲得' },
  ];

  return (
    <div className={styles.scoreCalculator}>
      <h3 className={styles.title}>{data.title}</h3>
      <p className={styles.description}>{data.description}</p>

      <div className={styles.calculatorContent}>
        <div className={styles.inputSection}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              宣言ペア数 (X):
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
              獲得フィールド数 (Y):
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
                {isSuccess ? '✅ 宣言達成' : '❌ 宣言失敗'}
              </span>
              <span className={styles.resultScore}>
                {score > 0 ? '+' : ''}{score}点
              </span>
            </div>

            <div className={styles.calculation}>
              <div className={styles.formula}>
                {isSuccess ? (
                  <>
                    <span>Y ≥ X なので：</span>
                    <span>0.5 × ({wonFields} - {declaredPairs}) + {declaredPairs} - 5</span>
                    <span>= 0.5 × {wonFields - declaredPairs} + {declaredPairs - 5}</span>
                    <span>= {0.5 * (wonFields - declaredPairs)} + {declaredPairs - 5} = <strong>{score}</strong></span>
                  </>
                ) : (
                  <>
                    <span>Y &lt; X なので：</span>
                    <span>{wonFields} - {declaredPairs} = <strong>{score}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.examplesSection}>
          <h4 className={styles.examplesTitle}>計算例</h4>
          <div className={styles.examplesList}>
            {examples.map((example, index) => {
              const exampleScore = calculateScore(example.declared, example.won);
              const exampleSuccess = example.won >= example.declared;

              return (
                <div key={index} className={styles.example}>
                  <div className={styles.exampleHeader}>
                    <span className={styles.exampleLabel}>{example.description}</span>
                    <span className={`${styles.exampleScore} ${exampleSuccess ? styles.positive : styles.negative}`}>
                      {exampleScore > 0 ? '+' : ''}{exampleScore}点
                    </span>
                  </div>
                  <div className={styles.exampleDetail}>
                    宣言{example.declared}ペア → 獲得{example.won}フィールド
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.tips}>
          <h4 className={styles.tipsTitle}>💡 スコアリングのコツ</h4>
          <ul className={styles.tipsList}>
            <li>安全な宣言（6-7ペア）は失敗リスクが低い</li>
            <li>宣言超過時のボーナスは控えめ（0.5倍）</li>
            <li>宣言失敗時のペナルティは厳しい（全差分マイナス）</li>
            <li>高宣言は成功時の基本点が高いが、リスクも大きい</li>
          </ul>
        </div>
      </div>
    </div>
  );
}