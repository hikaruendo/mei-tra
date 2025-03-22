import React from 'react';
import { CompletedField, Team } from '@/types/game.types';
import { Card } from '../card/Card';

interface CompletedFieldsProps {
  fields: CompletedField[];
  playerTeam: Team;
}

export const CompletedFields: React.FC<CompletedFieldsProps> = ({ fields, playerTeam }) => {
  return (
    <div className="completed-fields">
      {fields.map((field, index) => (
        field.winnerTeam === playerTeam && (
          <div key={index} className="completed-field">
            {field.cards.map((card: string, cardIndex: number) => (
              <Card 
                key={cardIndex}
                card={card}
                small={true}
                className="completed-field-card"
              />
            ))}
          </div>
        )
      ))}
    </div>
  );
}; 