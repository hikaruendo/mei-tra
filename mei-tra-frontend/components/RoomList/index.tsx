import React, { useState } from 'react';
import { useRoom } from '../../hooks/useRoom';
import { RoomStatus } from '../../types/room.types';
import styles from './index.module.css';

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
  const { availableRooms, createRoom, joinRoom, error, startGameRoom, togglePlayerReady, playerReadyStatus, currentRoom } = useRoom();
  const [newRoomName, setNewRoomName] = useState('');

  // 現在のプレイヤーIDを取得（ルームに参加している場合のみ）
  const currentPlayerId = currentRoom?.players.find(player => player.isReady !== undefined)?.playerId || '';

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      createRoom(newRoomName.trim());
      setNewRoomName('');
    }
  };

  // ルームをステータスごとに分類
  const waitingRooms = availableRooms.filter(room => room.status === RoomStatus.WAITING);
  const readyRooms = availableRooms.filter(room => room.status === RoomStatus.READY);
  const playingRooms = availableRooms.filter(room => room.status === RoomStatus.PLAYING);

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

      {/* 待機中のルーム */}
      <div className={styles.section}>
        <h3>待機中のルーム</h3>
        <div className={styles.roomList}>
          {waitingRooms.map((room) => (
            <div key={room.id} className={styles.roomItem}>
              <div className={styles.roomInfo}>
                <h3>{room.name}</h3>
                <p>プレイヤー: {room.players.length}/{room.settings.maxPlayers}</p>
                <p className={`${styles.status} ${getStatusClass(room.status)}`}>
                  ステータス: {getStatusText(room.status)}
                </p>
                {/* プレイヤーの準備状態を表示 */}
                <div className={styles.playerStatus}>
                  {room.players.map((player) => (
                    <div key={player.id} className={styles.playerStatusItem}>
                      <span className={styles.playerName}>{player.name}</span>
                      <span className={`${styles.readyStatus} ${playerReadyStatus[player.id] ? styles.ready : ''}`}>
                        {playerReadyStatus[player.id] ? '準備完了' : '準備中'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {room.players.length < room.settings.maxPlayers ? (
                <button
                  onClick={() => joinRoom(room.id)}
                  className={styles.joinButton}
                  disabled={room.players.length >= room.settings.maxPlayers}
                >
                  参加
                </button>
              ) : (
                <button
                  onClick={() => {
                    togglePlayerReady();
                  }}
                  className={`${styles.readyButton} ${playerReadyStatus[currentPlayerId] ? styles.ready : ''}`}
                >
                  {playerReadyStatus[currentPlayerId] ? '準備完了' : '準備する'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 準備完了のルーム */}
      <div className={styles.section}>
        <h3>準備完了のルーム</h3>
        <div className={styles.roomList}>
          {readyRooms.map((room) => (
            <div key={room.id} className={styles.roomItem}>
              <div className={styles.roomInfo}>
                <h3>{room.name}</h3>
                <p>プレイヤー: {room.players.length}/{room.settings.maxPlayers}</p>
                <p className={`${styles.status} ${getStatusClass(room.status)}`}>
                  ステータス: {getStatusText(room.status)}
                </p>
              </div>
              <button
                onClick={() => startGameRoom()}
                className={styles.startButton}
              >
                ゲーム開始
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ゲーム中のルーム */}
      <div className={styles.section}>
        <h3>ゲーム中のルーム</h3>
        <div className={styles.roomList}>
          {playingRooms.map((room) => (
            <div key={room.id} className={styles.roomItem}>
              <div className={styles.roomInfo}>
                <h3>{room.name}</h3>
                <p>プレイヤー: {room.players.length}/{room.settings.maxPlayers}</p>
                <p className={`${styles.status} ${getStatusClass(room.status)}`}>
                  ステータス: {getStatusText(room.status)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 