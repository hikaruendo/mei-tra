import React from 'react';
import { Player, GamePhase, GameActions, CompletedField, Team } from '@/types/game.types';
import { NegriCard } from '../NegriCard/NegriCard';
import { getSocket } from '@/app/socket';
import { Card } from '../card/Card';
import { CompletedFields } from '../CompletedFields/CompletedFields';

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
}) => {
  const renderPlayerHand = () => {
    const isCurrentPlayer = player.id === getSocket().id;
    const isWinningPlayer = currentHighestDeclaration?.playerId === player.id;
    
    if (isCurrentPlayer) {
      return (
        <div className="hand-container">
          {player.hand.map((card, index) => {
            const value = card.replace(/[♠♣♥♦]/, '');
            const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
            const isRed = suit === '♥' || suit === '♦';
            const isNegri = card === negriCard;
            const isJoker = card === 'JOKER';
            
            return (
              <div
                key={index}
                className={`card ${isRed || isNegri ? 'red-suit' : 'black-suit'} ${isNegri ? 'negri-card' : ''} ${isJoker ? 'joker' : ''} ${!negriCard && isWinningPlayer && gamePhase === 'play' ? 'player-info' : ''}`}
                onClick={() => {
                  if (gamePhase === 'play' && whoseTurn === getSocket().id) {
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
                  <div className="rank">JOKER</div>
                ) : (
                  <>
                    <div className="rank">{value}</div>
                    <div className="suit">{suit}</div>
                  </>
                )}
                {isNegri && <div className="negri-label">Negri</div>}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="hand-container">
        {Array(player.hand.length).fill(null).map((_, index) => (
          <div
            key={index}
            className="card face-down"
            style={{ transform: `rotate(${-10 + (index * 2)}deg)` }}
          >
            🂠
          </div>
        ))}
      </div>
    );
  };

  const isCurrentPlayer = player.id === getSocket().id;
  const isWinningPlayer = currentHighestDeclaration?.playerId === player.id;

  return (
    <div className={`player-position ${position}`}>
      <div className="player-info">
        <div className="player-info-group">
          {negriCard && negriPlayerId === player.id && (
            <NegriCard
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
            />
          )}
          <div className={`player-info-container ${isCurrentTurn ? 'current-turn' : ''}`}>
            <div className="player-name">{player.name}</div>
            <div className="card-count">{player.hand.length} cards</div>
            {isCurrentPlayer && isWinningPlayer && !negriCard && (
              <div className="flex flex-col items-center justify-center">Select Negri Card.</div>
            )}
            {isCurrentPlayer && agariCard && isWinningPlayer && (
              <div className="agari-card-container">
                <div className="agari-label">Agari Card is</div>
                <Card card={agariCard} />
              </div>
            )}
            {isCurrentPlayer && player.hasBroken && (
              <button 
                className="broken-button"
                onClick={() => gameActions.revealBrokenHand(player.id)}
              >
                Reveal Broken Hand
              </button>
            )}
          </div>
          {completedFields.some(field => field.winnerId === player.id) && (
            <div className="completed-fields-container">
              <CompletedFields 
                fields={completedFields.filter(field => field.winnerId === player.id)} 
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