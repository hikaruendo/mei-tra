import { GamePhase, TeamScores } from '../types';

interface ScoreDisplayProps {
  gamePhase: GamePhase;
  teamScores: TeamScores;
}

export function ScoreDisplay({ gamePhase, teamScores }: ScoreDisplayProps) {
  return (
    <div className="mb-4">
      <h3 className="text-xl font-bold">Current Phase: {gamePhase?.toUpperCase()}</h3>
      <div className="flex justify-center gap-8 mt-2">
        <div className="text-center">
          <h4 className="font-bold">Team 0</h4>
          <p>Deal: {teamScores[0].deal}</p>
          <p>Blow: {teamScores[0].blow}</p>
          <p>Play: {teamScores[0].play}</p>
          <p className="font-bold">Total: {teamScores[0].total}</p>
        </div>
        <div className="text-center">
          <h4 className="font-bold">Team 1</h4>
          <p>Deal: {teamScores[1].deal}</p>
          <p>Blow: {teamScores[1].blow}</p>
          <p>Play: {teamScores[1].play}</p>
          <p className="font-bold">Total: {teamScores[1].total}</p>
        </div>
      </div>
    </div>
  );
} 