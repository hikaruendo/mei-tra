import React, { useState } from 'react';
import { useRoom } from '../../hooks/useRoom';
import styles from './index.module.css';

export const RoomList: React.FC = () => {
  const { availableRooms, createRoom, joinRoom, error } = useRoom();
  const [newRoomName, setNewRoomName] = useState('');

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

      <div className={styles.roomList}>
        {availableRooms.map((room) => (
          <div key={room.id} className={styles.roomItem}>
            <div className={styles.roomInfo}>
              <h3>{room.name}</h3>
              <p>プレイヤー: {room.players.length}/{room.settings.maxPlayers}</p>
              <p>ステータス: {room.status}</p>
            </div>
            <button
              onClick={() => joinRoom(room.id)}
              className={styles.joinButton}
              disabled={room.players.length >= room.settings.maxPlayers}
            >
              参加
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}; 