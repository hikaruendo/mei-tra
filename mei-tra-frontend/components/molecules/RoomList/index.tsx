import React, { useState, useMemo } from 'react';
import { useRoom } from '../../../hooks/useRoom';
import { RoomStatus } from '../../../types/room.types';
import styles from './index.module.scss';
import { getSocket } from '../../../app/socket';

const getStatusText = (status: RoomStatus) => {
  switch (status) {
    case RoomStatus.WAITING:
      return 'Waiting';
    case RoomStatus.READY:
      return 'Ready';
    case RoomStatus.PLAYING:
      return 'Playing';
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
  const { availableRooms, createRoom, joinRoom, error, startGameRoom, togglePlayerReady, playerReadyStatus, currentRoom, leaveRoom, changePlayerTeam } = useRoom();
  const [newRoomName, setNewRoomName] = useState('');
  const [pointsToWin, setPointsToWin] = useState(5);
  const [teamAssignmentMethod, setTeamAssignmentMethod] = useState<'random' | 'host-choice'>('random');
  const [teamChanges, setTeamChanges] = useState<{ [key: string]: number }>({});
  const [setTeamText, setSetTeamText] = useState<string>('Update Teams');
  const socket = getSocket();

  const readyStatus = playerReadyStatus as Record<string, boolean>;

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
      createRoom(newRoomName.trim(), pointsToWin, teamAssignmentMethod);
      setNewRoomName('');
      setPointsToWin(5);
      setTeamAssignmentMethod('random');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Room List</h2>
        <form onSubmit={handleCreateRoom} className={styles.createForm}>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter room name"
            className={styles.input}
          />
          <input
            type="number"
            min={1}
            value={pointsToWin}
            onChange={(e) => setPointsToWin(Number(e.target.value))}
            placeholder="Points to Win"
            className={styles.input}
            style={{ width: 50 }}
          />
          <select
            value={teamAssignmentMethod}
            onChange={e => setTeamAssignmentMethod(e.target.value as 'random' | 'host-choice')}
            className={styles.input}
            style={{ width: 100 }}
          >
            <option value="random">Auto</option>
            <option value="host-choice">Manual</option>
          </select>
          <button type="submit" className={styles.createButton}>
            Create Room
          </button>
        </form>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.section}>
        <div className={styles.roomList}>
          {availableRooms.map((room) => {
            // ダミーを除外した実プレイヤー数
            const actualPlayerCount = room.players.filter(p => !p.playerId.startsWith('dummy-')).length;
            return (
              <div key={room.id} className={styles.roomItem}>
                <div className={styles.roomInfo}>
                  <h3>{room.name}</h3>
                  <p>Players: {actualPlayerCount}/{room.settings.maxPlayers}</p>
                  <p className={`${styles.status} ${getStatusClass(room.status)}`}>
                    Status: {getStatusText(room.status)}
                  </p>
                  {/* プレイヤーリストとチーム選択UI */}
                  <ul className={styles.playerList}>
                    {room.players.map((player) => (
                      <li key={player.playerId} className={styles.playerItem}>
                        <span className={styles.playerName}>{player.name}</span>
                        {/* チーム選択UI: ホストかつ手動割り当て時のみ */}
                        {room.settings.teamAssignmentMethod === 'host-choice' && room.hostId === currentPlayerId ? (
                          <div className={styles.teamSelectContainer}>
                            <select
                              value={teamChanges[player.playerId] ?? player.team}
                              onChange={e => {
                                const newTeam = Number(e.target.value);
                                setTeamChanges(prev => ({
                                  ...prev,
                                  [player.playerId]: newTeam
                                }));
                              }}
                              className={styles.teamSelect}
                            >
                              <option value={0}>Team 0</option>
                              <option value={1}>Team 1</option>
                            </select>
                          </div>
                        ) : (
                          <span className={styles.teamLabel}>Team {player.team}</span>
                        )}
                        {player.isHost && <span className={styles.hostLabel}>(Host)</span>}
                      </li>
                    ))}
                  </ul>
                  {/* チーム設定ボタン: ホストかつ手動割り当て時のみ */}
                  {room.settings.teamAssignmentMethod === 'host-choice' && room.hostId === currentPlayerId && (
                    <button
                      onClick={async () => {
                        try {
                          const result = await changePlayerTeam(room.id, teamChanges);
                          console.log('[RoomList] result:', result);
                          if (result) {
                            setSetTeamText('Teams Updated');
                            setTeamChanges({}); // 変更をクリア
                          }
                        } catch (error) {
                          console.error('[RoomList] Team change error:', error);
                        }
                      }}
                      className={styles.teamButton}
                      disabled={Object.keys(teamChanges).length === 0}
                    >
                      {setTeamText}
                    </button>
                  )}
                </div>
                {/* 参加ボタン: 自分が参加していないルームで、かつ満員でない場合のみ表示 */}
                {actualPlayerCount < room.settings.maxPlayers && 
                 currentRoom?.id !== room.id && (
                  <button
                    onClick={() => joinRoom(room.id)}
                    className={styles.joinButton}
                  >
                    Join
                  </button>
                )}
                {/* 準備ボタン: 自分が参加しているルームのみ表示 */}
                {currentRoom?.id === room.id && room.status !== RoomStatus.PLAYING && (
                  <button
                    onClick={() => togglePlayerReady()}
                    className={`${styles.readyButton} ${readyStatus[currentPlayerId] ? styles.ready : ''}`}
                  >
                    {readyStatus[currentPlayerId] ? 'Ready' : 'Ready Up'}
                  </button>
                )}
                {/* ゲーム開始ボタン: 自分がホストで、全員準備完了している場合のみ表示 */}
                {currentRoom?.id === room.id && 
                 room.status === RoomStatus.READY && 
                 room.hostId === currentPlayerId && (
                  <button
                    onClick={() => startGameRoom()}
                    className={styles.startButton}
                  >
                    Start Game
                  </button>
                )}
                {/* 退出ボタン: 自分が参加しているルームのみ表示 */}
                {currentRoom?.id === room.id && room.status !== RoomStatus.PLAYING && (
                  <button
                    onClick={() => leaveRoom(room.id)}
                    className={styles.leaveButton}
                  >
                    Leave
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 