'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Player } from '../../types/game.types';
import { PlayerAvatar } from '../PlayerAvatar';
import styles from './index.module.scss';

interface PreGameTableProps {
  players: Player[];
  currentPlayerId: string | null;
  isHost: boolean;
  onStart: () => void;
  onLeave: () => void;
}

const positions = ['bottom', 'left', 'top', 'right'] as const;

function createEmptySlot(index: number): Player {
  return {
    id: `empty-${index}`,
    playerId: `empty-${index}`,
    name: 'COM',
    team: 0,
    hand: [],
    isCOM: true,
  };
}

export const PreGameTable: React.FC<PreGameTableProps> = ({
  players,
  currentPlayerId,
  isHost,
  onStart,
  onLeave,
}) => {
  const tRoot = useTranslations();

  // Build 4 slots: current player at bottom, others fill left/top/right, empties become COM
  const currentPlayer = players.find(p => p.playerId === currentPlayerId) ?? createEmptySlot(0);
  const others = players.filter(p => p.playerId !== currentPlayerId);

  const slots: Player[] = [
    currentPlayer,
    others[0] ?? createEmptySlot(1),
    others[1] ?? createEmptySlot(2),
    others[2] ?? createEmptySlot(3),
  ];

  return (
    <div className={styles.playerPositions}>
      {slots.map((player, idx) => (
        <div
          key={player.playerId}
          className={`${styles.playerSeat} ${styles[positions[idx]]}`}
        >
          <PlayerAvatar player={player} size="medium" showName={true} />
        </div>
      ))}

      <div className={styles.center}>
        {isHost ? (
          <button className={styles.startButton} onClick={onStart}>
            {tRoot('room.start')}
          </button>
        ) : (
          <p className={styles.waitingText}>{tRoot('room.waitingForHost')}</p>
        )}
        <button className={styles.leaveButton} onClick={onLeave}>
          {tRoot('common.leave')}
        </button>
      </div>
    </div>
  );
};
