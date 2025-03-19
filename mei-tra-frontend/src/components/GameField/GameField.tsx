import React from 'react';
import { Player, Field } from '@/types/game.types';

interface GameFieldProps {
  currentField: Field | null;
  players: Player[];
}

export const GameField: React.FC<GameFieldProps> = ({
  currentField,
  players,
}) => {
  if (!currentField || currentField.cards.length === 0) {
    return null;
  }

  return (
    <div className="field-container">
      <div className="flex gap-4 justify-center">
        {currentField.cards.map((card: string, index: number) => {
          const isRed = card.match(/[♥♦]/);
          const playerId = players[index % players.length]?.id;
          const playerName = players.find(p => p.id === playerId)?.name;
          
          return (
            <div key={index} className="text-center">
              <div className="text-white mb-2">{playerName}</div>
              <div className={`card ${isRed ? 'red-suit' : 'black-suit'}`}>
                {card === 'JOKER' ? '🃏' : (
                  <>
                    {card.replace(/[♠♣♥♦]/, '')}
                    <span className="suit">{card.match(/[♠♣♥♦]/)?.[0]}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 