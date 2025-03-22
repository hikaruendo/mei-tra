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
  players: Player[];
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
  players,
}) => {
  const getRelativePosition = () => {
    const currentPlayerId = getSocket().id;
    const currentIndex = players.findIndex(p => p.id === currentPlayerId);
    const playerIndex = players.findIndex(p => p.id === player.id);

    if (player.id === currentPlayerId) return 'bottom';

    const currentTeam = players.find(p => p.id === currentPlayerId)?.team;
    const isTeammate = player.team === currentTeam;

    if (isTeammate) return 'top';

    const diff = (playerIndex - currentIndex + players.length) % players.length;

    if (diff === 1) return 'right';
    if (diff === 3) return 'left';

    return 'left'; // fallback
  };

  const renderPlayerHand = () => {
    const isCurrentPlayer = player.id === getSocket().id;
    
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
                className={`card ${selectedCards.includes(card) ? 'selected' : ''} ${isRed ? 'red-suit' : 'black-suit'} ${isNegri ? 'negri-card' : ''} ${isJoker ? 'joker' : ''}`}
                onClick={() => {
                  if (gamePhase === 'play' && whoseTurn === getSocket().id) {
                    gameActions.playCard(card);
                  } else {
                    setSelectedCards(selectedCards.includes(card) 
                      ? selectedCards.filter((c) => c !== card) 
                      : [...selectedCards, card]);
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

  const position = getRelativePosition();

  return (
    <div className={`player-position ${position}`}>
      <div className="player-info">
        <div className={`player-info-container ${isCurrentTurn ? 'current-turn' : ''}`}>
          <div className="player-name">{player.name}</div>
          <div className="card-count">{player.hand.length} cards</div>
        </div>
        {renderPlayerHand()}
        {negriCard && negriPlayerId === player.id && (
          <NegriCard
            negriCard={negriCard}
            negriPlayerId={negriPlayerId}
          />
        )}
      </div>
    </div>
  );
};