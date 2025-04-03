import { JSX } from 'react';
import { Player } from '../types';
import { getSocket } from '../socket';

interface TeamDisplayProps {
  teamNumber: number;
  players: Player[];
  whoseTurn: string | null;
  renderPlayerHand: (player: Player) => JSX.Element;
  negriCard: string | null;
  negriPlayerId: string | null;
  currentTrump?: string | null;
  numberOfPairs?: number;
}

export function TeamDisplay({
  teamNumber,
  players,
  whoseTurn,
  renderPlayerHand,
  negriCard,
  negriPlayerId,
  currentTrump,
  numberOfPairs,
}: TeamDisplayProps) {
  const currentPlayerId = getSocket().id;

  return (
    <div className="mb-8 w-full max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Team {teamNumber}</h3>
        {(currentTrump || numberOfPairs !== undefined) && (
          <div className="flex gap-4">
            {currentTrump && (
              <div className="bg-indigo-700 px-4 py-2 rounded-lg">
                <span className="text-white">Trump: </span>
                <span className="text-white font-bold">
                  {currentTrump === 'tra' && 'Tra (No Trump)'}
                  {currentTrump === 'hel' && 'Hel (Hearts ♥)'}
                  {currentTrump === 'daya' && 'Daya (Diamonds ♦)'}
                  {currentTrump === 'club' && 'Club (Clubs ♣)'}
                  {currentTrump === 'zuppe' && 'Zuppe (Spades ♠)'}
                </span>
              </div>
            )}
            {numberOfPairs !== undefined && (
              <div className="bg-green-700 px-4 py-2 rounded-lg">
                <span className="text-white">Pairs: </span>
                <span className="text-white font-bold">{numberOfPairs}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-around gap-4">
        {players.map((player) => (
          <div 
            key={player.id} 
            className={`card-container ${whoseTurn === player.id ? 'current-turn' : ''}`}
          >
            <div className="mb-2 text-center">
              <strong className="text-lg text-white player-name">{player.name}</strong>
              <span className="ml-2 text-gray-300 card-count">({player.hand.length})</span>
            </div>
            <div className="flex items-center gap-4">
              {renderPlayerHand(player)}
              {negriCard && negriPlayerId && player.id === negriPlayerId && (
                <div className="negri-card-display">
                  <div className="text-sm text-white mb-1">Negri Card</div>
                  {currentPlayerId === negriPlayerId ? (
                    <div className="card negri-card">
                      {negriCard === 'JOKER' ? <div className="rank">JOKER</div> : (
                        <>
                          {negriCard.replace(/[♠♣♥♦]/, '')}
                          <span className="suit">{negriCard.match(/[♠♣♥♦]/)?.[0]}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="card face-down negri-card">
                      🂠
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 