import { BlowDeclaration, Player, TrumpType } from '../types';

interface BlowControlsProps {
  isCurrentPlayer: boolean;
  currentPlayer: Player | undefined;
  selectedTrump: TrumpType | null;
  setSelectedTrump: (trump: TrumpType | null) => void;
  numberOfPairs: number;
  setNumberOfPairs: (pairs: number) => void;
  declareBlow: () => void;
  passBlow: () => void;
  blowDeclarations: BlowDeclaration[];
  currentHighestDeclaration: BlowDeclaration | null;
  players: Player[];
}

export function BlowControls({
  isCurrentPlayer,
  currentPlayer,
  selectedTrump,
  setSelectedTrump,
  numberOfPairs,
  setNumberOfPairs,
  declareBlow,
  passBlow,
  blowDeclarations,
  currentHighestDeclaration,
  players,
}: BlowControlsProps) {
  if (!isCurrentPlayer || currentPlayer?.isPasser) return null;

  return (
    <div className="blow-phase mt-4">
      <div className="blow-controls">
        <div className="flex gap-4 items-center">
          <select 
            value={selectedTrump || ''} 
            onChange={(e) => setSelectedTrump(e.target.value as TrumpType)}
            className="border rounded p-2"
          >
            <option value="">Select Trump</option>
            <option value="tra">Tra (No Trump)</option>
            <option value="hel">Hel (Hearts)</option>
            <option value="daya">Daya (Diamonds)</option>
            <option value="club">Club (Clubs)</option>
            <option value="zuppe">Zuppe (Spades)</option>
          </select>

          <input 
            type="number" 
            min="1" 
            value={numberOfPairs} 
            onChange={(e) => setNumberOfPairs(parseInt(e.target.value) || 0)}
            className="border rounded p-2 w-20"
            placeholder="Pairs"
          />

          <button 
            onClick={declareBlow}
            disabled={!selectedTrump || numberOfPairs < 1}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Declare
          </button>

          <button 
            onClick={passBlow}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Pass
          </button>
        </div>
      </div>

      <div className="blow-declarations mt-4">
        <h3 className="text-xl font-bold mb-2">Declarations</h3>
        <div className="flex flex-col gap-2">
          {blowDeclarations.map((declaration, index) => {
            const player = players.find(p => p.id === declaration.playerId);
            return (
              <div key={index} className="declaration-item">
                {player?.name}: {declaration.trumpType.toUpperCase()} {declaration.numberOfPairs} pairs
              </div>
            );
          })}
          {currentHighestDeclaration && (
            <div className="current-highest font-bold">
              Current Highest: {currentHighestDeclaration.trumpType.toUpperCase()} {currentHighestDeclaration.numberOfPairs} pairs
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 