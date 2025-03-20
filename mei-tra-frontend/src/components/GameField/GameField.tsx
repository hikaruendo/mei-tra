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

  // ディーラーのインデックスを取得
  const dealerIndex = players.findIndex(p => p.id === currentField.dealerId);
  
  return (
    <div className="field-container">
      <div className="flex gap-4 justify-center">
        {currentField.cards.map((card: string, index: number) => {
          const isRed = card.match(/[♥♦]/);
          // ディーラーから順番にプレイヤーを決定
          const playerIndex = (dealerIndex + index) % players.length;
          const player = players[playerIndex];
          
          return (
            <div key={index} className="text-center">
              <div className="text-white mb-2">{player.name}</div>
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