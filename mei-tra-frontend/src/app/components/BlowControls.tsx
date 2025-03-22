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
  if (currentPlayer?.isPasser) return null;

  const currentPlayerName = players.find(p => p.id === currentPlayer?.id)?.name;

  const handleDeclare = () => {
    declareBlow();
    // Reset form
    setSelectedTrump(null);
    setNumberOfPairs(0);
  };

  // Simplify to just check current player
  const isDisabled = !isCurrentPlayer;

  return (
    <div className="blow-phase mt-4 p-4 bg-gray-800 rounded-lg shadow-lg">
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }
        .declaring {
          background-color: #4CAF50 !important;
          transform: scale(0.95);
        }
      `}</style>
      <div className="text-center mb-4">
        <h3 className="text-2xl font-bold text-white">
          {!isCurrentPlayer 
            ? "Waiting for Your Turn" 
            : "It's Your Turn to Declare!"}
        </h3>
        <div className="mt-4">
          <div className={`inline-block px-6 py-3 rounded-lg ${
            isCurrentPlayer 
              ? 'bg-green-600 text-white animate-pulse'
              : 'bg-gray-700 text-white'
          }`}>
            Current Turn: {currentPlayerName}
          </div>
        </div>
      </div>
      <div className="blow-controls">
        <div className="flex gap-16 items-center">
          <div className="flex flex-col">
            <label className="text-white mb-2">Select Trump</label>
            <select 
              value={selectedTrump || ''} 
              onChange={(e) => setSelectedTrump(e.target.value as TrumpType)}
              className="border rounded p-2 bg-white text-black"
              disabled={isDisabled}
            >
              <option value="">Select Trump</option>
              <option value="tra">Tra (No Trump)</option>
              <option value="hel">Hel (Hearts)</option>
              <option value="daya">Daya (Diamonds)</option>
              <option value="club">Club (Clubs)</option>
              <option value="zuppe">Zuppe (Spades)</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-white mb-2">Number of Pairs</label>
            <input 
              type="number" 
              min="6" 
              value={numberOfPairs} 
              onChange={(e) => setNumberOfPairs(parseInt(e.target.value) || 0)}
              className="border rounded p-2 w-20 bg-white text-black"
              placeholder="Pairs"
              disabled={isDisabled}
            />
            <span className="text-gray-300 text-sm mt-1">Minimum: 6 pairs</span>
          </div>

          <div className="flex flex-col justify-end">
            <button 
              onClick={handleDeclare}
              disabled={!selectedTrump || numberOfPairs < 6 || isDisabled}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 transition-all duration-300"
            >
              Declare
            </button>
          </div>

          <div className="flex flex-col justify-end">
            <button 
              onClick={passBlow}
              disabled={isDisabled}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              Pass
            </button>
          </div>
        </div>
      </div>

      {blowDeclarations.length > 0 && (
        <div className="blow-declarations mt-6 text-white">
          <h4 className="text-lg font-bold mb-2">Current Declarations</h4>
          <div className="flex flex-col gap-2">
            {blowDeclarations.map((declaration, index) => {
              const player = players.find(p => p.id === declaration.playerId);
              const isLatestDeclaration = index === blowDeclarations.length - 1;
              return (
                <div 
                  key={index} 
                  className={`declaration-item bg-gray-700 p-2 rounded transition-all duration-300 ${
                    isLatestDeclaration ? 'animate-slide-in' : ''
                  }`}
                >
                  {player?.name}: {declaration.trumpType.toUpperCase()} {declaration.numberOfPairs} pairs
                </div>
              );
            })}
            {currentHighestDeclaration && (
              <div className="current-highest font-bold bg-blue-900 p-2 rounded mt-2">
                Current Highest: {currentHighestDeclaration.trumpType.toUpperCase()} {currentHighestDeclaration.numberOfPairs} pairs
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 