import { JSX } from 'react';
import { GamePhase } from '../types';

interface GameControlsProps {
  gamePhase: GamePhase;
  renderBlowControls: () => JSX.Element | null;
}

export function GameControls({
  gamePhase,
  renderBlowControls,
}: GameControlsProps) {
  return (
    <div className="flex flex-col items-center gap-4 w-fit-content z-9999">
      {gamePhase === 'blow' && renderBlowControls()}
    </div>
  );
} 