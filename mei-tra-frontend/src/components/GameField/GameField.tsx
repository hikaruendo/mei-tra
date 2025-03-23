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
      <div className="field-container-inner">
        {currentField.cards.map((card: string, index: number) => {
          const isRed = card.match(/[♥♦]/);
          const isJoker = card === 'JOKER';
          // ディーラーから順番にプレイヤーを決定
          const playerIndex = (dealerIndex + index) % players.length;
          const player = players[playerIndex];
          
          return (
            <div key={index} className="text-center">
              <div className="name">{player.name}</div>
              <div className={`card ${isRed ? 'red-suit' : 'black-suit'} ${isJoker ? 'joker' : ''}`}>
                {isJoker ? (
                  <div className="rank">JOKER</div>
                ) : (
                  <>
                    <div className="rank">{card.replace(/[♠♣♥♦]/, '')}</div>
                    <div className="suit">{card.match(/[♠♣♥♦]/)?.[0]}</div>
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