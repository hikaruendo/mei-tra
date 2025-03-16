import { JSX } from 'react';
import { Player } from '../types';

interface TeamDisplayProps {
  teamNumber: number;
  players: Player[];
  whoseTurn: string | null;
  renderPlayerHand: (player: Player) => JSX.Element;
}

export function TeamDisplay({
  teamNumber,
  players,
  whoseTurn,
  renderPlayerHand,
}: TeamDisplayProps) {
  return (
    <div className="mb-8 w-full max-w-4xl">
      <h3 className="text-xl font-bold mb-4 text-center text-white">Team {teamNumber}</h3>
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
            {renderPlayerHand(player)}
          </div>
        ))}
      </div>
    </div>
  );
} 