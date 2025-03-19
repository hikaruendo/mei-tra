import React from 'react';
import { Player, GamePhase } from '@/types/game.types';
import { NegriCard } from '../NegriCard/NegriCard';
import { getSocket } from '@/app/socket';

interface GameActions {
  selectNegri: (card: string) => void;
  playCard: (card: string) => void;
  declareBlow: () => void;
  passBlow: () => void;
}

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
  selectedCards: string[];
  setSelectedCards: (cards: string[]) => void;
  negriCard: string | null;
  negriPlayerId: string | null;
  gamePhase: GamePhase | null;
  whoseTurn: string | null;
  gameActions: GameActions;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  player,
  isCurrentTurn,
  selectedCards,
  setSelectedCards,
  negriCard,
  negriPlayerId,
  gamePhase,
  whoseTurn,
  gameActions,
}) => {
  const renderPlayerHand = () => {
    const isCurrentPlayer = player.id === getSocket().id;
    
    if (isCurrentPlayer) {
      return (
        <div className="flex flex-wrap gap-2">
          {player.hand.map((card, index) => {
            const value = card.replace(/[♠♣♥♦]/, '');
            const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
            const isRed = suit === '♥' || suit === '♦';
            const isNegri = card === negriCard;
            
            return (
              <div
                key={index}
                className={`card ${selectedCards.includes(card) ? 'selected' : ''} ${isRed ? 'red-suit' : 'black-suit'} ${isNegri ? 'negri-card' : ''}`}
                onClick={() => {
                  if (gamePhase === 'play' && whoseTurn === getSocket().id) {
                    gameActions.playCard(card);
                  } else {
                    setSelectedCards(selectedCards.includes(card) 
                      ? selectedCards.filter((c) => c !== card) 
                      : [...selectedCards, card]);
                  }
                }}
                style={{ transform: `rotate(${-15 + (index * 3)}deg)` }}
              >
                {card === 'JOKER' ? '🃏' : (
                  <>
                    {value}
                    <span className="suit">{suit}</span>
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
      <div className="flex gap-2">
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

  return (
    <div className={`player-info ${isCurrentTurn ? 'current-turn' : ''}`}>
      <div className="player-name">{player.name}</div>
      <div className="card-count">{player.hand.length} cards</div>
      {renderPlayerHand()}
      {negriCard && negriPlayerId === player.id && (
        <NegriCard
          negriCard={negriCard}
          negriPlayerId={negriPlayerId}
        />
      )}
    </div>
  );
}; 