'use client';

import React from 'react';
import styles from './index.module.scss';

interface GameJoinFormProps {
  name: string;
  onNameChange: (name: string) => void;
  onJoinGame: () => void;
}

export const GameJoinForm = ({
  name,
  onNameChange,
  onJoinGame,
}: GameJoinFormProps) => {
  return (
    <div className={styles.container}>
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
        </div>
      </div>
    </div>
  );
}; 