import React from 'react';
import styles from './index.module.scss';
import { Card } from '@/components/game/Card';
import { CardFace } from '@/components/game/CardFace';

interface NegriCardProps {
  negriCard: string;
  negriPlayerId: string;
  currentPlayerId: string;
}

export const NegriCard: React.FC<NegriCardProps> = ({
  negriCard,
  negriPlayerId,
  currentPlayerId,
}) => {
  const isNegriPlayer = currentPlayerId === negriPlayerId;

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