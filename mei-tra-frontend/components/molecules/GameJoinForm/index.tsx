'use client';

import React, { useState } from 'react';
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
  const [setText, setSetText] = useState<string>('Join Game');
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
            onClick={() => {
              onJoinGame();
              setSetText('Joined');
            }} 
            className={styles.joinBtn}
          >
            {setText}
          </button>
        </div>
      </div>
    </div>
  );
}; 