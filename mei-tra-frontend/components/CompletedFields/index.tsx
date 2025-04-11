import React from 'react';
import { CompletedField } from '../../types/game.types';
import styles from './index.module.css';
import { Card } from '../Card';

interface CompletedFieldsProps {
  fields: CompletedField[];
  players: { playerId: string; name: string }[];
}

export const CompletedFields: React.FC<CompletedFieldsProps> = ({ fields, players }) => {
  return (
    <div className={styles.completedFieldsContainer}>
      {fields.map((field, index) => {
        const winnerName = players.find(p => p.playerId === field.winnerId)?.name || 'Unknown';
        return (
          <div key={index} className={styles.completedField}>
            <div className={styles.winnerName}>{winnerName}</div>
            <div className={styles.cards}>
              {field.cards.map((card: string, cardIndex: number) => {
                return (
                  <Card 
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
  );
};