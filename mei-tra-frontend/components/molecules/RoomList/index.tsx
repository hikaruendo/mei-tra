import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRoom } from '../../../hooks/useRoom';
import { useSocket } from '../../../hooks/useSocket';
import { useGame } from '../../../hooks/useGame';
import { RoomStatus } from '../../../types/room.types';
import { getTeamOptionLabel } from '../../../lib/utils/teamUtils';
import { ConfirmModal } from '../ConfirmModal';
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
}

export const RoomList: React.FC<RoomListProps> = ({ isConnected, isConnecting }) => {
  const t = useTranslations();
  const { availableRooms, createRoom, joinRoom, error, startGameRoom, togglePlayerReady, playerReadyStatus, currentRoom, leaveRoom, changePlayerTeam } = useRoom();
  const game = useGame();
  const [newRoomName, setNewRoomName] = useState('');
  const [pointsToWin, setPointsToWin] = useState(5);
  const [teamAssignmentMethod, setTeamAssignmentMethod] = useState<'random' | 'host-choice'>('random');
  const [teamChanges, setTeamChanges] = useState<{ [key: string]: number }>({});
  const [setTeamText, setSetTeamText] = useState<string>(t('room.updateTeams'));
  const { socket } = useSocket();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [roomToLeave, setRoomToLeave] = useState<string | null>(null);

  const readyStatus = playerReadyStatus as Record<string, boolean>;
  const players = useMemo(() => game?.players || [], [game?.players]);

  // 現在のプレイヤーIDを取得
  const currentPlayerId = useMemo(() => {
    const socketId = socket?.id;
    if (!socketId) return '';
    const player = players.find(p => p.id === socketId);
    return player?.playerId || '';
  }, [players, socket?.id]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      createRoom(newRoomName.trim(), pointsToWin, teamAssignmentMethod);
      setNewRoomName('');
      setPointsToWin(5);
      setTeamAssignmentMethod('random');
    }
  };

  const handleLeaveClick = (roomId: string) => {
    setRoomToLeave(roomId);
    setShowConfirmModal(true);
  };

  const handleConfirmLeave = () => {
    if (roomToLeave) {
      leaveRoom(roomToLeave);
    }
    setShowConfirmModal(false);
    setRoomToLeave(null);
  };

  const handleCancelLeave = () => {
    setShowConfirmModal(false);
    setRoomToLeave(null);
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
          <input
            type="number"
            min={1}
            value={pointsToWin}
            onChange={(e) => setPointsToWin(Number(e.target.value))}
            placeholder={t('room.pointsToWin')}
            className={styles.input}
            style={{ width: 50 }}
          />
          <select
            value={teamAssignmentMethod}
            onChange={e => setTeamAssignmentMethod(e.target.value as 'random' | 'host-choice')}
            className={styles.input}
            style={{ width: 100 }}
          >
            <option value="random">{t('room.teamAuto')}</option>
            <option value="host-choice">{t('room.teamManual')}</option>
          </select>
          <button type="submit" className={styles.createButton}>
            {t('room.create')}
          </button>
        </form>
      </div>

      {/* 接続状態の表示 */}
      {isConnecting && <div className={styles.connecting}>{t('room.connecting')}</div>}
      {!isConnected && !isConnecting && <div className={styles.error}>{t('room.notConnected')}</div>}
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
                  <p>{t('room.players')}: {actualPlayerCount}/{room.settings.maxPlayers}</p>
                  <p className={`${styles.status} ${getStatusClass(room.status)}`}>
                    {t('room.status')}: {getStatusText(room.status, t)}
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
                              <option value={0}>{getTeamOptionLabel(currentRoom?.players || [], 0)}</option>
                              <option value={1}>{getTeamOptionLabel(currentRoom?.players || [], 1)}</option>
                            </select>
                          </div>
                        ) : (
                          <span className={styles.teamLabel}>{getTeamOptionLabel(currentRoom?.players || [], player.team)}</span>
                        )}
                        {player.isHost && <span className={styles.hostLabel}>{t('room.host')}</span>}
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
                            setSetTeamText(t('room.teamsUpdated'));
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
                    {t('room.join')}
                  </button>
                )}
                {/* 準備ボタン: 自分が参加しているルームのみ表示 */}
                {currentRoom?.id === room.id && room.status !== RoomStatus.PLAYING && (
                  <button
                    onClick={() => togglePlayerReady()}
                    className={`${styles.readyButton} ${readyStatus[currentPlayerId] ? styles.ready : ''}`}
                  >
                    {readyStatus[currentPlayerId] ? t('common.ready') : t('common.readyUp')}
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
                    {t('room.start')}
                  </button>
                )}
                {/* 退出ボタン: 自分が参加しているルームのみ表示 */}
                {currentRoom?.id === room.id && room.status !== RoomStatus.PLAYING && (
                  <button
                    onClick={() => handleLeaveClick(room.id)}
                    className={styles.leaveButton}
                  >
                    {t('common.leave')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title={t('room.leaveConfirm.title')}
        message={t('room.leaveConfirm.message')}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
        confirmText={t('common.leave')}
        cancelText={t('common.cancel')}
      />
    </div>
  );
}; 