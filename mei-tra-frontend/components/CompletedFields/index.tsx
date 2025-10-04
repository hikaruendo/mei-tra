import React from 'react';
import { useTranslations } from 'next-intl';
import { CompletedField } from '../../types/game.types';
import styles from './index.module.scss';
import { Card } from '../Card';

interface CompletedFieldsProps {
  fields: CompletedField[];
  players: { playerId: string; name: string }[];
}

export const CompletedFields: React.FC<CompletedFieldsProps> = ({ fields, players }) => {
  const t = useTranslations('completedFields');

  return (
    <div className={styles.completedFieldsContainer}>
      {fields.map((field, index) => {
        const winnerName = players.find(p => p.playerId === field.winnerId)?.name || t('unknown');
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