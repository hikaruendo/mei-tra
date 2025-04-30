import React, { useState, useMemo } from 'react';
import { useRoom } from '../../../hooks/useRoom';
import { RoomStatus } from '../../../types/room.types';
import styles from './index.module.css';
import { getSocket } from '../../../app/socket';

const getStatusText = (status: RoomStatus) => {
  switch (status) {
    case RoomStatus.WAITING:
      return '待機中';
    case RoomStatus.READY:
      return '準備完了';
    case RoomStatus.PLAYING:
      return 'ゲーム中';
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

export const RoomList: React.FC = () => {
  const { availableRooms, createRoom, joinRoom, error, startGameRoom, togglePlayerReady, playerReadyStatus, currentRoom, leaveRoom } = useRoom();
  const [newRoomName, setNewRoomName] = useState('');
  const socket = getSocket();

  // 現在のプレイヤーIDを取得
  const currentPlayerId = useMemo(() => {
    if (!currentRoom) return '';
    const socketId = socket.id;
    const player = currentRoom.players.find(p => p.id === socketId);
    return player?.playerId || '';
  }, [currentRoom, socket.id]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      createRoom(newRoomName.trim());
      setNewRoomName('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>ルーム一覧</h2>
        <form onSubmit={handleCreateRoom} className={styles.createForm}>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="ルーム名を入力"
            className={styles.input}
          />
          <button type="submit" className={styles.createButton}>
            ルーム作成
          </button>
        </form>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.section}>
        <div className={styles.roomList}>
          {availableRooms.map((room) => (
            <div key={room.id} className={styles.roomItem}>
              <div className={styles.roomInfo}>
                <h3>{room.name}</h3>
                <p>プレイヤー: {room.players.length}/{room.settings.maxPlayers}</p>
                <p className={`${styles.status} ${getStatusClass(room.status)}`}>
                  ステータス: {getStatusText(room.status)}
                </p>
              </div>
              {room.players.length < room.settings.maxPlayers && (
                <button
                    onClick={() => joinRoom(room.id)}
                    className={styles.joinButton}
                    disabled={room.players.length >= room.settings.maxPlayers}
                >
                  参加
                </button>
              )}
              <button
                onClick={() => togglePlayerReady()}
                className={`${styles.readyButton} ${playerReadyStatus[currentPlayerId] ? styles.ready : ''}`}
                disabled={currentRoom?.id !== room.id}
              >
                {playerReadyStatus[currentPlayerId]
                  ? '準備完了'
                  : '準備する'}
              </button>
              {room.status === RoomStatus.READY && (
                <button
                  onClick={() => startGameRoom()}
                  className={styles.startButton}
                >
                  ゲーム開始
                </button>
              )}
              {currentRoom?.id === room.id && (
                <button
                  onClick={() => leaveRoom(room.id)}
                  className={styles.leaveButton}
                >
                  退出
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 