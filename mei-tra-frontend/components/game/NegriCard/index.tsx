import React from 'react';
import styles from './index.module.scss';
import { Card } from '@/components/game/Card';
import { CardFace } from '@/components/game/CardFace';

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

  return (
    <div className={styles.negriCardDisplay}>
      {isNegriPlayer ? (
        <div className={styles.negriField}>
          <Card card={negriCard} />
        </div>
      ) : (
        <div className={styles.cardFaceDown}>
          <CardFace faceDown />
        </div>
      )}
    </div>
  );
};
