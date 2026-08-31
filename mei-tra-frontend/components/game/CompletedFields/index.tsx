import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
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

/**
 * A trick is only ever added or dropped whole, so its contents identify it.
 * An array index would not: a `game-state` resync re-sends the whole list, and
 * a pile the player had opened would follow the index rather than the trick.
 */
const trickKey = (field: CompletedField) =>
  `${field.winnerSeatId}|${field.winnerTeam}|${field.cards.join(',')}`;

export const CompletedFields: React.FC<CompletedFieldsProps> = ({ fields }) => {
  const t = useTranslations('completedFields');
  const [openedKey, setOpenedKey] = useState<string | null>(null);

  // Derived, not reset in an effect: a new round arrives as an empty list and
  // the key simply stops matching anything.
  const openKey = fields.some((field) => trickKey(field) === openedKey)
    ? openedKey
    : null;

  return (
    <div className={styles.completedFieldsPanel}>
      {fields.length > 0 && (
        <div className={styles.completedFieldsContainer}>
          {fields.map((field, index) => {
            const key = trickKey(field);
            const isOpen = key === openKey;

            return (
              <button
                key={key}
                type="button"
                className={`${styles.pile} ${isOpen ? styles.open : ''}`}
                aria-expanded={isOpen}
                aria-label={t(isOpen ? 'hideTrick' : 'revealTrick', {
                  index: index + 1,
                })}
                onClick={() => setOpenedKey(isOpen ? null : key)}
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
