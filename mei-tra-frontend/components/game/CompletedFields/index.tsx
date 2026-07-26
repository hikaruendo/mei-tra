import React from 'react';
import { CompletedField } from '@/types/game.types';
import { CardFace } from '@/components/game/CardFace';
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

interface TakenCardPreviewProps {
  card: string;
  className?: string;
}

export const TakenCardPreview: React.FC<TakenCardPreviewProps> = ({
  card,
  className = '',
}) => {
  if (card === 'JOKER') {
    return (
      <span
        className={`${styles.cardCorner} ${styles.jokerCardCorner} ${className}`}
        aria-label={card}
      >
        <CardFace card={card} className={styles.jokerCardFace} />
      </span>
    );
  }

  const mark = getCardMark(card);

  return (
    <span
      className={`${styles.cardCorner} ${mark.isRed ? styles.redCardCorner : ''} ${className}`}
      aria-label={card}
    >
      <span className={styles.cardRank}>{mark.rank}</span>
      <span className={styles.cardSuit}>{mark.suit}</span>
    </span>
  );
};

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
                    return (
                      <TakenCardPreview
                        key={cardIndex}
                        card={card}
                      />
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
