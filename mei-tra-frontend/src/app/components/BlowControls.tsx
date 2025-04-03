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
  const currentPlayerName = players.find(p => p.playerId === currentPlayer?.playerId)?.name;

  const handleDeclare = () => {
    if (!isCurrentPlayer) return;
    declareBlow();
    // Reset form
    setSelectedTrump(null);
    setNumberOfPairs(0);
  };

  const handlePass = () => {
    if (!isCurrentPlayer) return;
    passBlow();
  };

  // Disable controls if it's not the current player's turn
  const isDisabled = !isCurrentPlayer;

  return (
    <div className="fixed">
      <div className="blow-controls-container">
        <div className="blow-controls-title">
          <h3 className="text-white text-lg font-bold mb-2">
            {!isCurrentPlayer 
              ? "Waiting for Your Turn" 
              : "It's Your Turn to Declare!"}
          </h3>
          <div className={`inline-block px-6 py-3 rounded-lg ${
            isCurrentPlayer 
              ? 'bg-green-600 text-white animate-pulse'
              : 'bg-gray-700 text-white'
          }`}>
            Current Turn: {currentPlayerName}
          </div>
        </div>
      
        <div className="blow-controls-body">
          <div className="flex items-center">
            <div className="flex flex-col">
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
              <input 
                type="number" 
                min="6" 
                value={numberOfPairs} 
                onChange={(e) => setNumberOfPairs(parseInt(e.target.value) || 0)}
                className="border rounded p-2 w-20 bg-white text-black"
                placeholder="Pairs"
                disabled={isDisabled}
              />
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
                onClick={handlePass}
                disabled={isDisabled}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                Pass
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="blow-declarations">
        <h4>Current Declarations</h4>
        <div className="flex flex-col gap-2">
          <div className="declaration-items">
            {players.map((player) => {
              const declaration = blowDeclarations.find(d => d.playerId === player.playerId);
              const isLatestDeclaration = declaration && 
                declaration === blowDeclarations[blowDeclarations.length - 1];
              const isHighestDeclaration = currentHighestDeclaration && 
                declaration &&
                declaration.playerId === currentHighestDeclaration.playerId &&
                declaration.trumpType === currentHighestDeclaration.trumpType &&
                declaration.numberOfPairs === currentHighestDeclaration.numberOfPairs;

              if (player.isPasser) {
                return (
                  <div 
                    key={`pass-${player.playerId}`}
                    className="declaration-item pass-item"
                  >
                    {player.name}: Passed
                  </div>
                );
              }

              if (declaration) {
                return (
                  <div 
                    key={declaration.playerId}
                    className={`declaration-item ${
                      isLatestDeclaration ? 'animate-slide-in' : ''
                    } ${isHighestDeclaration ? 'current-highest' : ''}`}
                  >
                    {player.name}: {declaration.trumpType.toUpperCase()} {declaration.numberOfPairs} pairs
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
} 