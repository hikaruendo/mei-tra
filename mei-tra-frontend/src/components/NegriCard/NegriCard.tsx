import React from 'react';
import styles from './index.module.css';
import { Card } from '../card/Card';
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
          <Card 
            card={negriCard}
            small={true}
            className={styles.negriCard}
          />
        </div>
      ) : (
        <div className={styles.cardFaceDown}>🂠</div>
      )}
    </div>
  );
};