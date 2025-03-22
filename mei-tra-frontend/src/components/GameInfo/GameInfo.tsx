import React from 'react';
import { Player, GamePhase, TrumpType, TeamScores } from '@/types/game.types';

interface GameInfoProps {
  gamePhase: GamePhase | null;
  currentTrump: TrumpType | null;
  whoseTurn: string | null;
  players: Player[];
  teamScores: TeamScores;
}

export const GameInfo: React.FC<GameInfoProps> = ({
  gamePhase,
  currentTrump,
  whoseTurn,
  players,
  teamScores,
}) => {
  return (
    <div className="game-info">
      <div className="current-trump">
        {currentTrump && (
          <div className="text-white">
            Current Trump: {currentTrump}
          </div>
        )}
      </div>
      <div className="turn-indicator">
        {whoseTurn && (
          <div className="text-white">
            Current Turn: {players.find(p => p.id === whoseTurn)?.name}
          </div>
        )}
      </div>
      <div className="phase-indicator">
        {gamePhase && (
          <div className="text-white">
            Phase: {gamePhase}
          </div>
        )}
      </div>
      <div className="scores">
        <div className="text-white">
          Team 0: {teamScores[0].total} points
        </div>
        <div className="text-white">
          Team 1: {teamScores[1].total} points
        </div>
      </div>
    </div>
  );
}; 