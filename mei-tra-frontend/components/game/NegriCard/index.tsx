import React, { useEffect, useState } from 'react';
import styles from './index.module.scss';
import { CardFace } from '@/components/game/CardFace';
import { TakenCardPreview } from '@/components/game/CompletedFields';

interface NegriCardProps {
  negriCard: string;
  negriSeatId: string;
  currentSeatId: string;
}

export const NegriCard: React.FC<NegriCardProps> = ({
  negriCard,
  negriSeatId,
  currentSeatId,
}) => {
  const isNegriPlayer = currentSeatId === negriSeatId;
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => setIsRevealed(false), [negriCard]);

  const stopParentInteraction = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div className={styles.negriCardDisplay}>
      {isNegriPlayer && isRevealed ? (
        <button
          type="button"
          className={styles.negriField}
          onClick={(event) => {
            stopParentInteraction(event);
            setIsRevealed(false);
          }}
        >
          <TakenCardPreview card={negriCard} />
        </button>
      ) : (
        <button
          type="button"
          className={styles.cardFaceDown}
          onClick={isNegriPlayer ? (event) => {
            stopParentInteraction(event);
            setIsRevealed(true);
          } : undefined}
          aria-label={isNegriPlayer ? 'Reveal Negri card' : 'Negri card'}
        >
          <CardFace faceDown />
        </button>
      )}
    </div>
  );
};
