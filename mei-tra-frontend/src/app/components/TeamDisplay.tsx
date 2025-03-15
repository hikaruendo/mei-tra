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
    <div className="mb-8">
      <h3 className="text-xl font-bold mb-4">Team {teamNumber}</h3>
      <div className="flex justify-center gap-4">
        {players.map((player) => (
          <div 
            key={player.id} 
            className={`card-container ${whoseTurn === player.id ? 'current-turn' : ''}`}
          >
            <div className="mb-2">
              <strong className="font-bold player-name">{player.name}</strong>
              <span className="ml-2 card-count">({player.hand.length} cards)</span>
            </div>
            {renderPlayerHand(player)}
          </div>
        ))}
      </div>
    </div>
  );
} 