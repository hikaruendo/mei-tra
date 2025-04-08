import React from 'react';
import styles from './index.module.css';

interface CardProps {
  card: string;
  small?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  card,
  small = false,
  className = '',
}) => {
  const value = card.replace(/[♠♣♥♦]/, '');
  const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
  const isRed = suit === '♥' || suit === '♦';

  return (
    <div className={`${styles.card} ${isRed ? styles.redSuit : styles.blackSuit} ${small ? styles.small : ''} ${className}`}>
      {card === 'JOKER' ? <div className={styles.rank}>JOKER</div> : (
        <>
          {value}
          <span className={styles.suit}>{suit}</span>
        </>
      )}
    </div>
  );
}; 