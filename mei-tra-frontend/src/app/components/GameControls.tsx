import { JSX } from 'react';
import { getSocket } from '../socket';
import { GamePhase } from '../types';

interface GameControlsProps {
  gamePhase: GamePhase;
  whoseTurn: string | null;
  selectedCards: string[];
  endPhase: () => void;
  startBlow: () => void;
  renderBlowControls: () => JSX.Element | null;
}

export function GameControls({
  gamePhase,
  whoseTurn,
  endPhase,
  startBlow,
  renderBlowControls,
}: GameControlsProps) {
  const isCurrentPlayerTurn = getSocket().id === whoseTurn;

  return (
    <div className="flex gap-4 mt-4">
      {gamePhase === 'deal' && isCurrentPlayerTurn && (
        <button 
          onClick={startBlow} 
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Start Blow Phase
        </button>
      )}

      {gamePhase === 'blow' && renderBlowControls()}

      {gamePhase === 'play' && isCurrentPlayerTurn && (
        <button 
          onClick={endPhase} 
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          End Phase
        </button>
      )}
    </div>
  );
} 