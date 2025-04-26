import React, { useState } from 'react';
import { Player, GamePhase, GameActions, CompletedField, Field, TrumpType } from '../../types/game.types';
import { NegriCard } from '../NegriCard';
import { Card } from '../Card';
import { CompletedFields } from '../CompletedFields';
import styles from './index.module.css';
import { useCardValidation } from './hooks/useCardValidation';
import { PlayAndCancelBtn } from '../PlayAndCancelBtn';

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
  currentField: Field | null;
  currentTrump: TrumpType | null;
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
  currentField,
  currentTrump,
}) => {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedNegriCard, setSelectedNegriCard] = useState<string | null>(null);

  const { isValidCardPlay } = useCardValidation(
    player.hand,
    currentField,
    currentTrump,
  );

  const handleCardClick = (card: string) => {
    if (gamePhase === 'play' && whoseTurn === currentPlayerId) {
      if (!negriCard && currentHighestDeclaration?.playerId === player.playerId) {
        setSelectedNegriCard(card);
      } else {
        setSelectedCard(card);
      }
    }
  };

  const isCurrentPlayer = currentPlayerId === player.playerId;
  const isWinningPlayer = currentHighestDeclaration?.playerId === player.playerId;

  const renderPlayerHand = (isCurrentPlayer: boolean) => {    
    if (isCurrentPlayer) {
      return (
        <div className={styles.handContainer}>
          {player.hand.map((card, index) => {
            const value = card.replace(/[♠♣♥♦]/, '');
            const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
            const isRed = suit === '♥' || suit === '♦';
            const isNegri = card === negriCard;
            const isJoker = card === 'JOKER';
            const isSelected = card === selectedCard || card === selectedNegriCard;
            
            const validationResult = isValidCardPlay(card);
            const isPlayable = isCurrentPlayer && validationResult.isValid;
            
            return (
              <div
                key={index}
                className={`${styles.card} ${isRed || isNegri ? styles.redSuit : styles.blackSuit} ${isNegri ? styles.negriCard : ''} ${isJoker ? styles.joker : ''} ${isSelected ? styles.selected : ''} ${isPlayable ? styles.playable : styles.unplayable}`}
                onClick={() => {
                  if (gamePhase === 'play' && whoseTurn === currentPlayerId && isPlayable) {
                    handleCardClick(card);
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
            <PlayAndCancelBtn
              setSelectedCard={setSelectedCard}
              onClick={() => {
                gameActions.playCard(selectedCard);
                setSelectedCard(null);
              }}
              buttonText="Play"
            />
          )}
          {selectedNegriCard && (
            <PlayAndCancelBtn
              setSelectedCard={setSelectedNegriCard}
              onClick={() => {
                gameActions.selectNegri(selectedNegriCard);
                setSelectedNegriCard(null);
              }}
              buttonText="Negri"
            />
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
        {renderPlayerHand(isCurrentPlayer)}
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