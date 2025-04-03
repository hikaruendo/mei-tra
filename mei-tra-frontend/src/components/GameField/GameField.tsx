import React from 'react';
import { Player, Field } from '@/types/game.types';

interface GameFieldProps {
  currentField: Field | null;
  players: Player[];
  onBaseSuitSelect: (suit: string) => void;
  isCurrentPlayer: boolean;
  currentTrump: string;
}

export const GameField: React.FC<GameFieldProps> = ({
  currentField,
  players,
  onBaseSuitSelect,
  isCurrentPlayer,
  currentTrump,
}) => {
  const isJokerBaseCard = currentField?.baseCard === 'JOKER';
  // ジョーカーかつcurrentTrumpがtraの場合は、ベーススートを選択する必要がある
  const needsBaseSuitSelection = isJokerBaseCard && currentTrump === 'tra' && !currentField?.baseSuit && isCurrentPlayer;

  if (!currentField || currentField.cards.length === 0) {
    return null;
  }

  // ディーラーのインデックスを取得
  const dealerIndex = players.findIndex(p => p.playerId === currentField.dealerId);
  
  // ディーラーが見つからない場合は、最初のプレイヤーをディーラーとする
  const effectiveDealerIndex = dealerIndex === -1 ? 0 : dealerIndex;
  
  return (
    <div className={'field-container'}>
      {currentField && (
        <div className="field-container-outer">
          <div className="field-container-inner">
            {currentField.cards.map((card: string, index: number) => {
              const isRed = card.match(/[♥♦]/);
              const isJoker = card === 'JOKER';
              // ディーラーから順番にプレイヤーを決定
              const playerIndex = (effectiveDealerIndex + index) % players.length;
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

          {needsBaseSuitSelection ? (
            <div className="base-suit-selection">
              <h3>Select Base Suit</h3>
              <div className="suit-buttons">
                <button onClick={() => onBaseSuitSelect('♠')}>♠</button>
                <button onClick={() => onBaseSuitSelect('♥')}>♥</button>
                <button onClick={() => onBaseSuitSelect('♦')}>♦</button>
                <button onClick={() => onBaseSuitSelect('♣')}>♣</button>
              </div>
            </div>
          ) : currentTrump === 'tra' && currentField?.baseSuit && (
            <div className="base-suit-selection">
              <h3>Selected Base Suit</h3>
              <div className="suit-buttons">
                <button disabled className={`selected-suit ${currentField.baseSuit === '♠' ? 'black-suit' : ''} ${currentField.baseSuit === '♥' || currentField.baseSuit === '♦' ? 'red-suit' : ''} ${currentField.baseSuit === '♣' ? 'black-suit' : ''}`}>
                  {currentField.baseSuit}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 