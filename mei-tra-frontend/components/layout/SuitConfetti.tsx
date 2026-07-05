'use client';

import { useEffect, useMemo } from 'react';
import styles from './SuitConfetti.module.scss';

const SUITS = ['♠', '♥', '♦', '♣'] as const;

interface SuitConfettiProps {
  onDone: () => void;
  message?: string;
}

export function SuitConfetti({ onDone, message = '百年、めくり続けて。' }: SuitConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => {
        const suitIndex = i % 4;
        return {
          id: i,
          suit: SUITS[suitIndex],
          isRed: suitIndex === 1 || suitIndex === 2,
          left: Math.random() * 100,
          delay: Math.random() * 0.7,
          duration: 2.4 + Math.random() * 1.6,
          drift: Math.round((Math.random() - 0.5) * 160),
          spin: Math.round((Math.random() - 0.5) * 540),
          scale: 0.75 + Math.random() * 0.9,
        };
      }),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(onDone, 3800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={styles.overlay} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`${styles.piece} ${p.isRed ? styles.red : styles.dark}`}
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
              '--scale': p.scale,
            } as React.CSSProperties
          }
        >
          {p.suit}
        </span>
      ))}
      <div className={styles.note}>
        <span className={styles.noteMark}>♠ ♥ ♦ ♣</span>
        <span className={styles.noteMain}>{message}</span>
      </div>
    </div>
  );
}
