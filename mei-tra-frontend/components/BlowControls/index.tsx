import { BlowDeclaration, Player, TrumpType } from '../../types/game.types';
import styles from './index.module.css';

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
    <div className={styles.blowControlsContainer}>
      <div className={styles.content}>
        <div className={styles.title}>
          <div className={`${styles.currentTurn} ${isCurrentPlayer ? styles.active : styles.inactive}`}>
            Current Turn: {currentPlayerName}
          </div>
        </div>
      
        <div className={styles.controls}>
          <div className={styles.controlsRow}>
            <select 
              value={selectedTrump || ''} 
              onChange={(e) => setSelectedTrump(e.target.value as TrumpType)}
              className={styles.select}
              disabled={isDisabled}
            >
              <option value="">Select Trump</option>
              <option value="tra">Tra</option>
              <option value="herz">Herz (♥)</option>
              <option value="daiya">Daiya (♦)</option>
              <option value="club">Club (♣)</option>
              <option value="zuppe">Zuppe (♠)</option>
            </select>

            <input 
              type="number" 
              min="6" 
              value={numberOfPairs || ''} 
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                setNumberOfPairs(value);
              }}
              className={styles.input}
              placeholder="Pairs"
              disabled={isDisabled}
            />

            <div className={styles.buttonGroup}>
              <button 
                onClick={handleDeclare}
                disabled={!selectedTrump || numberOfPairs < 6 || isDisabled}
                className={`${styles.button} ${styles.declareButton}`}
              >
                Declare
              </button>

              <button 
                onClick={handlePass}
                disabled={isDisabled}
                className={`${styles.button} ${styles.passButton}`}
              >
                Pass
              </button>
            </div>
          </div>
        </div>

        <div className={styles.declarations}>
          <div className={styles.declarationList}>
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
                    className={`${styles.declarationItem} ${styles.pass}`}
                  >
                    {player.name}: Passed
                  </div>
                );
              }

              if (declaration) {
                return (
                  <div 
                    key={declaration.playerId}
                    className={`${styles.declarationItem} ${
                      isLatestDeclaration ? styles.animateSlideIn : ''
                    } ${isHighestDeclaration ? styles.highest : ''}`}
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