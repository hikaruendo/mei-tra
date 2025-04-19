'use client';

import styles from './index.module.css';
interface GameJoinFormProps {
  name: string;
  onNameChange: (name: string) => void;
  onJoinGame: () => void;
  onStartGame: () => void;
  playerCount: number;
}

export const GameJoinForm = ({
  name,
  onNameChange,
  onJoinGame,
  onStartGame,
  playerCount,
}: GameJoinFormProps) => {
  return (
    <div className={styles.gameJoinForm}>
      <input 
        type="text" 
        placeholder="Enter name" 
        value={name} 
        onChange={(e) => onNameChange(e.target.value)} 
        className={styles.input} 
      />
      <div className={styles.btnContainer}>
        <button 
          onClick={onJoinGame} 
          className={styles.joinBtn}
        >
          Join Game
        </button>
        <button 
          className={styles.startBtn} 
          onClick={onStartGame}
          disabled={playerCount < 4}
        >
          Start Game
          <span className={styles.playerCount}>
            {playerCount}/4 players
          </span>
        </button>
      </div>
    </div>
  );
}; 