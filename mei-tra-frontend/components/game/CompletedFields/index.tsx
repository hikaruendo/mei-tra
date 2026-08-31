import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CompletedField } from '@/types/game.types';
import { CardFace } from '@/components/game/CardFace';
import { completedFieldKey } from '@meitra/game-client/completed-field';
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
  const t = useTranslations('completedFields');
  const [openedKeys, setOpenedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggle = (key: string) =>
    setOpenedKeys((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });

  return (
    <div className={styles.completedFieldsPanel}>
      {fields.length > 0 && (
        <div className={styles.completedFieldsContainer}>
          {fields.map((field, index) => {
            const key = completedFieldKey(field);
            // Read straight from the set rather than pruning it: a new round
            // arrives as an empty list and the keys simply stop matching, so
            // nothing has to reset the state.
            const isOpen = openedKeys.has(key);

            return (
              <button
                key={key}
                type="button"
                className={`${styles.pile} ${isOpen ? styles.open : ''}`}
                aria-expanded={isOpen}
                aria-label={t(isOpen ? 'hideTrick' : 'revealTrick', {
                  index: index + 1,
                })}
                onClick={() => toggle(key)}
              >
                <span className={styles.cards}>
                  {field.cards.map((card: string, cardIndex: number) => (
                    <span
                      key={cardIndex}
                      className={styles.slot}
                      style={
                        { '--slot-index': cardIndex } as React.CSSProperties
                      }
                    >
                      <span className={styles.flip}>
                        <span className={styles.flipBack} aria-hidden="true">
                          <CardFace faceDown className={styles.backArt} />
                        </span>
                        <span className={styles.flipFront}>
                          <TakenCardPreview card={card} />
                        </span>
                      </span>
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
