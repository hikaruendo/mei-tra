import React from 'react';
import { CompletedField, Team } from '../../types/game.types';
import { Card } from '../Card';
import styles from './index.module.css';

interface CompletedFieldsProps {
  fields: CompletedField[];
  playerTeam: Team;
}

export const CompletedFields: React.FC<CompletedFieldsProps> = ({ fields, playerTeam }) => {
  return (
    <div className={styles.completedFieldsContainer}>
      {fields.map((field, index) => (
        <div key={index} className={styles.completedField}>
          {field.cards.map((card: string, cardIndex: number) => (
            field.winnerTeam === playerTeam ? (
              <Card 
                key={cardIndex}
                card={card}
                small={true}
                className={styles.completedFieldCard}
              />
            ) : (
              <div key={cardIndex} className={styles.cardFaceDown}>🂠</div>
            )
          ))}
        </div>
      ))}
    </div>
  );
};