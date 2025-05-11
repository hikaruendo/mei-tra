import React from 'react';
import styles from './index.module.scss';

interface CardProps {
  card: string;
}

export const Card: React.FC<CardProps> = ({
  card,
}) => {
  const value = card.replace(/[♠♣♥♦]/, '');
  const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
  const isRed = suit === '♥' || suit === '♦';
  const isJoker = card === 'JOKER';

  return (
    <div
      className={`${styles.card} ${isRed ? styles.redSuit : styles.blackSuit} ${isJoker ? styles.joker : ''}`}
    >
      {isJoker ? (
        <div className={styles.jokerRank}>JOKER</div>
      ) : (
        <>
          <div className={styles.rank}>{value}</div>
          <div className={styles.suit}>{suit}</div>
        </>
      )}
    </div>
  );
}; 