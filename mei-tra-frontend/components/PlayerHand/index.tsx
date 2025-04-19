import React, { useState } from 'react';
import { Player, GamePhase, GameActions, CompletedField } from '../../types/game.types';
import { NegriCard } from '../NegriCard';
import { Card } from '../Card';
import { CompletedFields } from '../CompletedFields';
import styles from './index.module.css';

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
  negriCard: string | null;
  negriPlayerId: string | null;
  gamePhase: GamePhase | null;
  whoseTurn: string | null;
  gameActions: GameActions;
  position: string;
  agariCard?: string;
  currentHighestDeclaration?: { playerId: string };
  completedFields: CompletedField[];
  currentPlayerId: string;
  players: Player[];
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  player,
  isCurrentTurn,
  negriCard,
  negriPlayerId,
  gamePhase,
  whoseTurn,
  gameActions,
  position,
  agariCard,
  currentHighestDeclaration,
  completedFields,
  currentPlayerId,
  players,
}) => {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const renderPlayerHand = () => {
    const isCurrentPlayer = currentPlayerId === player.playerId;
    const isWinningPlayer = currentHighestDeclaration?.playerId === player.playerId;
    
    if (isCurrentPlayer) {
      return (
        <div className={styles.handContainer}>
          {player.hand.map((card, index) => {
            const value = card.replace(/[♠♣♥♦]/, '');
            const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
            const isRed = suit === '♥' || suit === '♦';
            const isNegri = card === negriCard;
            const isJoker = card === 'JOKER';
            const isSelected = card === selectedCard;
            
            return (
              <div
                key={index}
                className={`${styles.card} ${isRed || isNegri ? styles.redSuit : styles.blackSuit} ${isNegri ? styles.negriCard : ''} ${isJoker ? styles.joker : ''} ${isSelected ? styles.selected : ''}`}
                onClick={() => {
                  if (gamePhase === 'play' && whoseTurn === currentPlayerId) {
                    if (!negriCard && isWinningPlayer) {
                      gameActions.selectNegri(card);
                    } else {
                      setSelectedCard(card);
                    }
                  }
                }}
                style={{ '--card-index': index } as React.CSSProperties}
              >
                {isJoker ? (
                  <div className={styles.jokerRank}>JOKER</div>
                ) : (
                  <>
                    <div className={styles.rank}>{value}</div>
                    <div className={styles.suit}>{suit}</div>
                  </>
                )}
                {isNegri && <div className={styles.negriLabel}>Negri</div>}
              </div>
            );
          })}
          {selectedCard && (
            <div className={styles.confirmationButtons}>
              <button 
                className={styles.cancelButton}
                onClick={() => setSelectedCard(null)}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={() => {
                  gameActions.playCard(selectedCard);
                  setSelectedCard(null);
                }}
              >
                Play
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={styles.otherPlayerHandContainer}>
        {Array(player.hand.length).fill(null).map((_, cardIndex) => (
          <div key={cardIndex} className={styles.cardFaceDown}>🂠</div>
        ))}
      </div>
    );
  };

  const isCurrentPlayer = currentPlayerId === player.playerId;
  const isWinningPlayer = currentHighestDeclaration?.playerId === player.playerId;

  return (
    <div className={`${styles.playerPosition} ${styles[position]}`}>
      <div className={styles.playerInfo}>
        <div className={styles.playerInfoGroup}>
          {negriCard && negriPlayerId === player.playerId && (
            <NegriCard
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              currentPlayerId={currentPlayerId}
            />
          )}
          <div className={`${styles.playerInfoContainer} ${isCurrentTurn ? styles.currentTurn : ''}`}>
            <div className={styles.playerName}>{player.name}</div>
            <div className={styles.cardCount}>{player.hand.length} cards</div>
            {gamePhase === 'play' && isCurrentPlayer && isWinningPlayer && !negriCard && (
              <div className={styles.selectNegriCard}>Select Negri Card.</div>
            )}
            {isCurrentPlayer && agariCard && isWinningPlayer && (
              <div className={styles.agariCardContainer}>
                <div className={styles.agariLabel}>Agari</div>
                <Card card={agariCard} />
              </div>
            )}
            {gamePhase === 'blow' && isCurrentPlayer && player.hasBroken && (
              <button 
                className={styles.brokenButton}
                onClick={() => gameActions.revealBrokenHand(player.playerId)}
              >
                Reveal Broken Hand
              </button>
            )}
          </div>
        </div>
        {renderPlayerHand()}
        {completedFields.length > 0 && (
          <CompletedFields 
            fields={completedFields}
            players={players}
          />
        )}
      </div>
    </div>
  );
};