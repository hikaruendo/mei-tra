'use client';

import { TeamScore, TeamScoreRecord } from '@/types/game.types';

interface ScoreBoardProps {
  teamScores: { [key: number]: TeamScore };
  teamScoreRecords: { [key: number]: TeamScoreRecord };
  roundNumber: number;
}

export const ScoreBoard = ({ teamScores, teamScoreRecords, roundNumber }: ScoreBoardProps) => {
  const getCurrentRoundScore = (teamId: number) => {
    const record = teamScoreRecords[teamId];
    if (!record?.roundScores || !record.roundScores[roundNumber - 1]) {
      return null;
    }
    return record.roundScores[roundNumber - 1];
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Round {roundNumber}</h2>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(teamScores).map(([teamId, score]) => {
          const currentRoundScore = getCurrentRoundScore(parseInt(teamId));
          return (
            <div key={teamId} className="border p-3 rounded">
              <h3 className="font-semibold mb-2">Team {parseInt(teamId) + 1}</h3>
              <p className="text-2xl font-bold">{score.total} points</p>
              <div className="mt-2 text-sm">
                <p>This round:</p>
                {currentRoundScore ? (
                  <ul className="list-disc list-inside">
                    <li>Declared: {currentRoundScore.declared} pairs</li>
                    <li>Actual: {currentRoundScore.actual} pairs</li>
                    <li>Points: {currentRoundScore.points}</li>
                  </ul>
                ) : (
                  <p className="text-gray-500">No data</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 