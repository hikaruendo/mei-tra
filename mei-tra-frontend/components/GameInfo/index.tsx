import React from 'react';
import { Player, TrumpType, TeamScores } from '../../types/game.types';

interface GameInfoProps {
  currentTrump: TrumpType | null;
  numberOfPairs: number;
  whoseTurn: string | null;
  players: Player[];
  teamScores: TeamScores;
}

export const GameInfo: React.FC<GameInfoProps> = ({
  currentTrump,
  numberOfPairs,
  whoseTurn,
  players,
  teamScores,
}) => {
  const currentPlayer = players.find(p => p.playerId === whoseTurn)?.name;

  const getTrumpDisplay = () => {
    if (!currentTrump) return '';
    const trumpMap: Record<TrumpType, string> = {
      'tra': 'Tra',
      'herz': '♥',
      'daiya': '♦',
      'club': '♣',
      'zuppe': '♠'
    };
    return trumpMap[currentTrump];
  };

  return (
    <div className="game-info-container">
      <div className="game-info-content">
        {/* Current Trump */}
        {currentTrump && (
          <div className="game-info-trump">
            <span className="game-info-trump-text">
              Trump: {getTrumpDisplay()} Num: {numberOfPairs}
            </span>
          </div>
        )}

        {/* Current Player */}
        {whoseTurn && (
          <div className="game-info-current-player">
            <span className="game-info-current-player-text">
              Turn: {currentPlayer}
            </span>
          </div>
        )}

        {/* Scores */}
        <div className="game-info-scores">
          <div className="game-info-score-team1">
            <span className="game-info-score-text">
              Team 0: {teamScores[0].total}
            </span>
          </div>
          <div className="game-info-score-team2">
            <span className="game-info-score-text">
              Team 1: {teamScores[1].total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}; 