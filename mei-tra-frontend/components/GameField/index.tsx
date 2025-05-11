import React from 'react';
import { Player, Field } from '../../types/game.types';
import styles from './index.module.scss';

interface GameFieldProps {
  currentField: Field | null;
  players: Player[];
  onBaseSuitSelect: (suit: string) => void;
  isCurrentPlayer: boolean;
}

export const GameField: React.FC<GameFieldProps> = ({
  currentField,
  players,
  onBaseSuitSelect,
  isCurrentPlayer,
}) => {
  const isJokerBaseCard = currentField?.baseCard === 'JOKER';
  // If it's a Joker, base suit selection is needed
  const needsBaseSuitSelection = isJokerBaseCard && !currentField?.baseSuit && isCurrentPlayer;

  if (!currentField || currentField.cards.length === 0) {
    return null;
  }

  // ディーラーのインデックスを取得
  const dealerIndex = players.findIndex(p => p.playerId === currentField.dealerId);
  
  // ディーラーが見つからない場合は、最初のプレイヤーをディーラーとする
  const effectiveDealerIndex = dealerIndex === -1 ? 0 : dealerIndex;
  
  return (
    <div className={styles.fieldContainer}>
      {currentField && (
        <div className={styles.fieldContainerOuter}>
          <div className={styles.fieldContainerInner}>
            {currentField.cards.map((card: string, index: number) => {
              const isRed = card.match(/[♥♦]/);
              const isJoker = card === 'JOKER';
              // ディーラーから順番にプレイヤーを決定
              const playerIndex = (effectiveDealerIndex + index) % players.length;
              const player = players[playerIndex];
              
              return (
                <div key={index} className={styles.fieldContent}>
                  <div className={styles.name}>{player.name}</div>
                  <div className={`${styles.card} ${isRed ? styles.redSuit : styles.blackSuit} ${isJoker ? styles.joker : ''}`}>
                    {isJoker ? (
                      <div className={styles.jokerRank}>JOKER</div>
                    ) : (
                      <>
                        <div className={styles.rank}>{card.replace(/[♠♣♥♦]/, '')}</div>
                        <div className={styles.suit}>{card.match(/[♠♣♥♦]/)?.[0]}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {needsBaseSuitSelection ? (
            <div className={styles.baseSuitSelection}>
              <h3>Select Base Suit</h3>
              <div className={styles.suitButtons}>
                <button onClick={() => onBaseSuitSelect('♠')}>♠</button>
                <button onClick={() => onBaseSuitSelect('♥')}>♥</button>
                <button onClick={() => onBaseSuitSelect('♦')}>♦</button>
                <button onClick={() => onBaseSuitSelect('♣')}>♣</button>
              </div>
            </div>
          ) : currentField?.baseSuit && (
            <div className={styles.baseSuitSelection}>
              <h3>Suit</h3>
              <div className={styles.suitButtons}>
                <button disabled className={`${styles.selectedSuit} ${currentField.baseSuit === '♠' ? styles.blackSuit : ''} ${currentField.baseSuit === '♥' || currentField.baseSuit === '♦' ? styles.redSuit : ''} ${currentField.baseSuit === '♣' ? styles.blackSuit : ''}`}>
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