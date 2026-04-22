'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('gameJoin');
  const [setText, setSetText] = useState<string>(t('joinGame'));

  return (
    <div className={styles.container}>
      <div className={styles.gameJoinForm}>
        <input
          type="text"
          placeholder={t('enterName')}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={styles.input}
        />
        <div className={styles.btnContainer}>
          <button
            onClick={() => {
              onJoinGame();
              setSetText(t('joined'));
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