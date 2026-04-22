'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Player } from '@/types/game.types';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import { getConsistentTableOrderWithSelfBottom } from '@/lib/utils/tableOrder';
import styles from './index.module.scss';

interface PreGameTableProps {
  players: Player[];
  currentPlayerId: string | null;
  isHost: boolean;
  onStart: () => void;
  onLeave: () => void;
  shuffleTeams?: () => void;
  onRemovePlayer?: (playerId: string) => void;
}

const positions = ['bottom', 'left', 'top', 'right'] as const;

function createEmptySlot(index: number): Player {
  return {
    socketId: `empty-${index}`,
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
  shuffleTeams,
  onRemovePlayer,
}) => {
  const tRoot = useTranslations();

  const ordered = currentPlayerId
    ? getConsistentTableOrderWithSelfBottom(players, currentPlayerId)
    : new Array(4).fill(undefined);

  const slots: Player[] = ordered.map((p, idx) => {
    if (!p) return createEmptySlot(idx);
    if (p.isCOM && !p.isReady) return { ...p, name: 'COM' };
    return p;
  });

  return (
    <div className={styles.playerPositions}>
      {slots.map((player, idx) => (
        <div
          key={player.playerId}
          className={`${styles.playerSeat} ${styles[positions[idx]]}`}
        >
          <div className={styles.seatContent}>
            <PlayerAvatar player={player} size="medium" showName={true} />
            {isHost &&
              onRemovePlayer &&
              !player.isCOM &&
              player.playerId !== currentPlayerId && (
                <button
                  type="button"
                  className={styles.seatActionButton}
                  onClick={() => onRemovePlayer(player.playerId)}
                >
                  {tRoot('room.removePlayer')}
                </button>
              )}
          </div>
        </div>
      ))}

      <div className={styles.center}>
        {isHost ? (
          <>
            {shuffleTeams && (
              <button className={styles.shuffleButton} onClick={shuffleTeams}>
                {tRoot('room.shuffleTeams')}
              </button>
            )}
            <button className={styles.startButton} onClick={onStart}>
              {tRoot('room.start')}
            </button>
          </>
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
