import React from 'react';
import { CompletedField } from '@/types/game.types';
import styles from './index.module.scss';

interface CompletedFieldsProps {
  fields: CompletedField[];
}

const SUIT_SYMBOLS: Record<string, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

function getCardMark(card: string) {
  if (card === 'JOKER') {
    return { rank: 'J', suit: '★', isRed: true };
  }

  const prefixedCard = card.match(/^([SHDC])-(.+)$/);
  if (prefixedCard) {
    const [, suit, rank] = prefixedCard;
    return {
      rank,
      suit: SUIT_SYMBOLS[suit] ?? suit,
      isRed: suit === 'H' || suit === 'D',
    };
  }

  const suit = card.match(/[♠♣♥♦]/)?.[0] ?? '';
  return {
    rank: card.replace(/[♠♣♥♦]/, ''),
    suit,
    isRed: suit === '♥' || suit === '♦',
  };
}

export const CompletedFields: React.FC<CompletedFieldsProps> = ({ fields }) => {
  return (
    <div className={styles.completedFieldsPanel}>
      {fields.length > 0 && (
        <div className={styles.completedFieldsContainer}>
          {fields.map((field, index) => {
            return (
              <div key={index} className={styles.completedField}>
                <div className={styles.cards}>
                  {field.cards.map((card: string, cardIndex: number) => {
                    const mark = getCardMark(card);

                    return (
                      <span
                        key={cardIndex}
                        className={`${styles.cardCorner} ${
                          mark.isRed ? styles.redCardCorner : ''
                        }`}
                        aria-label={card}
                      >
                        <span className={styles.cardRank}>{mark.rank}</span>
                        <span className={styles.cardSuit}>{mark.suit}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
