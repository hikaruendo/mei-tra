'use client';

import { useTranslations } from 'next-intl';
import { TeamScore, TeamScoreRecord } from '../../types/game.types';

interface ScoreBoardProps {
  teamScores: { [key: number]: TeamScore };
  teamScoreRecords: { [key: number]: TeamScoreRecord };
  roundNumber: number;
}

export const ScoreBoard = ({ teamScores, teamScoreRecords, roundNumber }: ScoreBoardProps) => {
  const t = useTranslations('scoreBoard');

  const getCurrentRoundScore = (teamId: number) => {
    const record = teamScoreRecords[teamId];
    if (!record?.roundScores || !record.roundScores[roundNumber - 1]) {
      return null;
    }
    return record.roundScores[roundNumber - 1];
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">{t('round')} {roundNumber}</h2>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(teamScores).map(([teamId, score]) => {
          const currentRoundScore = getCurrentRoundScore(parseInt(teamId));
          return (
            <div key={teamId} className="border p-3 rounded">
              <h3 className="font-semibold mb-2">{t('team')} {parseInt(teamId) + 1}</h3>
              <p className="text-2xl font-bold">{score.total} {t('points')}</p>
              <div className="mt-2 text-sm">
                <p>{t('thisRound')}</p>
                {currentRoundScore ? (
                  <ul className="list-disc list-inside">
                    <li>{t('declared')} {currentRoundScore.declared} {t('pairs')}</li>
                    <li>{t('actual')} {currentRoundScore.actual} {t('pairs')}</li>
                    <li>{t('score')} {currentRoundScore.points}</li>
                  </ul>
                ) : (
                  <p className="text-gray-500">{t('noData')}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 