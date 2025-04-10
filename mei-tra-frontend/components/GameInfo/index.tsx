import React from 'react';
import { TrumpType, TeamScores } from '../../types/game.types';
import styles from './index.module.css';

interface GameInfoProps {
  currentTrump: TrumpType | null;
  currentHighestDeclarationPlayer: string | null;
  numberOfPairs: number;
  teamScores: TeamScores;
}

export const GameInfo: React.FC<GameInfoProps> = ({
  currentTrump,
  currentHighestDeclarationPlayer,
  numberOfPairs,
  teamScores,
}) => {
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
    <div className={styles.gameInfoContainer}>
      <div className={styles.gameInfoContent}>
        {/* Current Trump */}
        {currentTrump && (
          <div className={styles.gameInfoTrump}>
            <span className={styles.gameInfoTrumpText}>
              👑 {currentHighestDeclarationPlayer} : {getTrumpDisplay()}{numberOfPairs}
            </span>
          </div>
        )}

        {/* Scores */}
        <div className={styles.gameInfoScores}>
          <span className={styles.gameInfoScoreText0}>
            Team0: {teamScores[0].total}
          </span>
          <span className={styles.gameInfoScoreText1}>
            Team1: {teamScores[1].total}
          </span>
        </div>
      </div>
    </div>
  );
}; 