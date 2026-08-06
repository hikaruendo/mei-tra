'use client';

import { useState } from 'react';
import styles from './InteractiveDemo.module.scss';

interface InteractiveDemoProps {
  config: {
    title: string;
    description: string;
  };
}

type TrumpType = 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';

const scenarios = [
  {
    currentDeclaration: 'スペード6組',
    options: [
      { trump: 'club' as TrumpType, pairs: 6, label: 'クラブ6組', correct: true },
      { trump: 'zuppe' as TrumpType, pairs: 7, label: 'スペード7組', correct: true },
      { trump: 'zuppe' as TrumpType, pairs: 5, label: 'スペード5組', correct: false },
    ],
  },
  {
    currentDeclaration: 'クラブ7組',
    options: [
      { trump: 'daiya' as TrumpType, pairs: 7, label: 'ダイヤ7組', correct: true },
      { trump: 'club' as TrumpType, pairs: 8, label: 'クラブ8組', correct: true },
      { trump: 'zuppe' as TrumpType, pairs: 8, label: 'スペード8組', correct: false },
    ],
  },
  {
    currentDeclaration: 'ダイヤ8組',
    options: [
      { trump: 'herz' as TrumpType, pairs: 8, label: 'ハート8組', correct: true },
      { trump: 'tra' as TrumpType, pairs: 8, label: 'トラ8組', correct: true },
      { trump: 'daiya' as TrumpType, pairs: 7, label: 'ダイヤ7組', correct: false },
    ],
  },
  {
    currentDeclaration: 'ハート9組',
    options: [
      { trump: 'tra' as TrumpType, pairs: 9, label: 'トラ9組', correct: true },
      { trump: 'herz' as TrumpType, pairs: 10, label: 'ハート10組', correct: true },
      { trump: 'club' as TrumpType, pairs: 9, label: 'クラブ9組', correct: false },
    ],
  },
];;;

export function InteractiveDemo({ config }: InteractiveDemoProps) {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const scenario = scenarios[currentScenario];

  const handleOptionClick = (index: number) => {
    const option = scenario.options[index];
    setSelectedOption(index);

    if (option.correct) {
      setFeedback('正解！これは上位宣言です。');
    } else {
      setFeedback('残念！この宣言は前の宣言より弱いです。');
    }
  };

  const nextScenario = () => {
    if (currentScenario < scenarios.length - 1) {
      setCurrentScenario(currentScenario + 1);
      setSelectedOption(null);
      setFeedback(null);
    }
  };

  const reset = () => {
    setCurrentScenario(0);
    setSelectedOption(null);
    setFeedback(null);
  };

  return (
    <div className={styles.interactiveDemo}>
      <h3 className={styles.title}>{config.title}</h3>
      <p className={styles.description}>{config.description}</p>

      <div className={styles.demoContent}>
        <div className={styles.scenario}>
          <p className={styles.currentDeclaration}>
            現在の宣言: <strong>{scenario.currentDeclaration}</strong>
          </p>
          <p className={styles.prompt}>上位宣言を選んでください:</p>
        </div>

        <div className={styles.options}>
          {scenario.options.map((option, index) => (
            <button
              key={index}
              className={`${styles.optionButton} ${
                selectedOption === index
                  ? option.correct
                    ? styles.correct
                    : styles.incorrect
                  : ''
              }`}
              onClick={() => handleOptionClick(index)}
              disabled={selectedOption !== null}
            >
              {option.label}
            </button>
          ))}
        </div>

        {feedback && (
          <div className={styles.feedback}>
            <p>{feedback}</p>
          </div>
        )}

        <div className={styles.controls}>
          {currentScenario < scenarios.length - 1 && selectedOption !== null && (
            <button className={styles.nextButton} onClick={nextScenario}>
              次の問題
            </button>
          )}
          {currentScenario === scenarios.length - 1 && selectedOption !== null && (
            <button className={styles.resetButton} onClick={reset}>
              最初から
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
