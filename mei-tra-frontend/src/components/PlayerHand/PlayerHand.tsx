import React from 'react';
import { Player, GamePhase, GameActions, CompletedField, Team } from '@/types/game.types';
import { NegriCard } from '../NegriCard/NegriCard';
import { Card } from '../card/Card';
import { CompletedFields } from '../CompletedFields/CompletedFields';
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
  playerTeam: Team;
  currentPlayerId: string;
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
  playerTeam,
  currentPlayerId,
}) => {
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
            
            return (
              <div
                key={index}
                className={`${styles.card} ${isRed || isNegri ? styles.redSuit : styles.blackSuit} ${isNegri ? styles.negriCard : ''} ${isJoker ? styles.joker : ''}`}
                onClick={() => {
                  if (gamePhase === 'play' && whoseTurn === currentPlayerId) {
                    if (!negriCard && isWinningPlayer) {
                      gameActions.selectNegri(card);
                    } else {
                      gameActions.playCard(card);
                    }
                  }
                }}
                style={{ '--card-index': index } as React.CSSProperties}
              >
                {isJoker ? (
                  <div className={styles.jokerRank}>JOKER</div>
                ) : (
                  <>
                    <div className={styles.rank }>{value}</div>
                    <div className={styles.suit}>{suit}</div>
                  </>
                )}
                {isNegri && <div className={styles.negriLabel}>Negri</div>}
              </div>
            );
          })}
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
            {isCurrentPlayer && isWinningPlayer && !negriCard && (
              <div className={styles.selectNegriCard}>Select Negri Card.</div>
            )}
            {isCurrentPlayer && agariCard && isWinningPlayer && (
              <div className={styles.agariCardContainer}>
                <div className={styles.agariLabel}>Agari Card is</div>
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
          {completedFields.some(field => field.winnerId === player.playerId) && (
            <div className={styles.completedFieldsContainer}>
              <CompletedFields 
                fields={completedFields.filter(field => field.winnerId === player.playerId)} 
                playerTeam={playerTeam} 
              />
            </div>
          )}
        </div>
        {renderPlayerHand()}
      </div>
    </div>
  );
};