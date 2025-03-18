import { JSX } from 'react';
import { getSocket } from '../socket';
import { GamePhase } from '../types';

interface GameControlsProps {
  gamePhase: GamePhase;
  whoseTurn: string | null;
  selectedCards: string[];
  renderBlowControls: () => JSX.Element | null;
}

export function GameControls({
  gamePhase,
  whoseTurn,
  renderBlowControls,
}: GameControlsProps) {
  const isCurrentPlayerTurn = getSocket().id === whoseTurn;
  console.log('GameControls render:', { gamePhase, whoseTurn, isCurrentPlayerTurn });

  return (
    <div className="flex flex-col items-center gap-4 mt-4 w-full max-w-4xl">
      {gamePhase === 'blow' && (
        <div className="w-full">
          {isCurrentPlayerTurn ? (
            <div className="text-center mb-4">
              <div className="inline-block bg-green-600 text-white px-4 py-2 rounded-full animate-pulse">
                Your Turn
              </div>
            </div>
          ) : (
            <div className="text-center mb-4">
              <div className="inline-block bg-gray-600 text-white px-4 py-2 rounded-full">
                Waiting for Other Player
              </div>
            </div>
          )}
          {renderBlowControls()}
        </div>
      )}
    </div>
  );
} 