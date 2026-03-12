import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRoom } from '../../../hooks/useRoom';
import { useBackendStatus } from '../../../hooks/useBackendStatus';
import { RoomStatus } from '../../../types/room.types';
import { User } from '../../../types/game.types';
import styles from './index.module.scss';

const getStatusText = (status: RoomStatus, t: (key: string) => string) => {
  switch (status) {
    case RoomStatus.WAITING:
      return t('room.statusWaiting');
    case RoomStatus.READY:
      return t('room.statusReady');
    case RoomStatus.PLAYING:
      return t('room.statusPlaying');
    default:
      return status;
  }
};

const getStatusClass = (status: RoomStatus) => {
  switch (status) {
    case RoomStatus.WAITING:
      return styles.statusWaiting;
    case RoomStatus.READY:
      return styles.statusReady;
    case RoomStatus.PLAYING:
      return styles.statusPlaying;
    default:
      return '';
  }
};

interface RoomListProps {
  isConnected?: boolean;
  isConnecting?: boolean;
  users?: User[];
  currentPlayerId?: string | null;
}

export const RoomList: React.FC<RoomListProps> = ({
  isConnected,
  isConnecting,
  users = [],
  currentPlayerId: currentPlayerIdProp = null,
}) => {
  const t = useTranslations();
  const memoizedUsers = useMemo(() => users, [users]);
  const { availableRooms, createRoom, joinRoom, error, currentRoom } = useRoom({ users: memoizedUsers, currentPlayerId: currentPlayerIdProp ?? null });
  const [newRoomName, setNewRoomName] = useState('');
  const [pointsToWin, setPointsToWin] = useState(5);
  const { backendStatus, isLoading } = useBackendStatus();

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      createRoom(newRoomName.trim(), pointsToWin, 'random');
      setNewRoomName('');
      setPointsToWin(5);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t('room.title')}</h2>
        <form onSubmit={handleCreateRoom} className={styles.createForm}>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder={t('room.roomName')}
            className={styles.input}
          />
          <div className={styles.pointsToWinContainer}>
            <span className={styles.pointsToWinText}>{t('room.pointsToWin')}</span>
            <input
              type="number"
              min={1}
              value={pointsToWin}
              onChange={(e) => setPointsToWin(Number(e.target.value))}
              className={styles.pointsToWinInput}
            />
          </div>
          <button
            type="submit"
            className={styles.createButton}
            disabled={backendStatus.isStarting}
          >
            {t('room.create')}
          </button>
        </form>
      </div>

      {/* バックエンドステータスの表示 */}
      {!isLoading && (
        <div className={`${styles.backendStatus} ${styles[`status-${backendStatus.status}`]}`}>
          {backendStatus.status === 'ok' && t('room.backendStatus.ok')}
          {backendStatus.status === 'degraded' && t('room.backendStatus.degraded')}
          {backendStatus.status === 'error' && t('room.backendStatus.error')}
        </div>
      )}
      {backendStatus.isStarting && (
        <div className={styles.startingMessage}>
          {t('room.backendStatus.starting')}
        </div>
      )}

      {/* 接続状態の表示 */}
      {isConnecting && <div className={styles.connecting}>{t('room.connecting')}</div>}
      {!isConnected && !isConnecting && <div className={styles.error}>{t('room.notConnected')}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.section}>
        <div className={styles.roomList}>
          {availableRooms.map((room) => {
            const actualPlayerCount = room.players.filter(p => !p.isCOM).length;
            return (
              <div key={room.id} className={styles.roomItem}>
                <div className={styles.roomInfo}>
                  <h3>{room.name}</h3>
                  <p>{t('room.players')}: {actualPlayerCount}/{room.settings.maxPlayers}</p>
                  <p className={`${styles.status} ${getStatusClass(room.status)}`}>
                    {t('room.status')}: {getStatusText(room.status, t)}
                  </p>
                  <ul className={styles.playerList}>
                    {room.players.map((player) => (
                      <li key={player.playerId} className={styles.playerItem}>
                        <span className={styles.playerName}>{player.name}</span>
                        {player.isHost && <span className={styles.hostLabel}>{t('room.host')}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                {(() => {
                  const isPlayingRoom = room.status === RoomStatus.PLAYING;
                  const hasComSeat = room.players.some((p) => p.isCOM === true);
                  const canJoin =
                    (!isPlayingRoom && actualPlayerCount < room.settings.maxPlayers) ||
                    (isPlayingRoom && hasComSeat);
                  return canJoin && currentRoom?.id !== room.id && (
                    <button
                      onClick={() => joinRoom(room.id)}
                      className={styles.joinButton}
                      disabled={backendStatus.isStarting}
                    >
                      {t('room.join')}
                    </button>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
