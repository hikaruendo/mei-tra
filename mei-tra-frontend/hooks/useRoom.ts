import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { PlayerContract, RoomPlayingPayload } from '@contracts/game';
import type {
  RoomContract,
  RoomPlayerJoinedPayload,
  RoomSyncPayload,
} from '@contracts/room';
import { useSocket } from './useSocket';
import {
  Room,
  RoomPlayer,
  fromRoomContract,
  fromRoomContracts,
  fromRoomSyncPayload,
} from '../types/room.types';
import { useAuth } from '../contexts/AuthContext';
import { ConnectionUser, Team } from '../types/game.types';
import { RoomStatus } from '../types/room.types';

interface UseRoomOptions {
  users?: ConnectionUser[];
  currentPlayerId?: string | null;
}

export const useRoom = (options: UseRoomOptions = {}) => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playerReadyStatus, setPlayerReadyStatus] = useState<Record<string, boolean>>({});
  const [isClient, setIsClient] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();

  const users = useMemo(() => options.users ?? [], [options.users]);
  const currentPlayerId = options.currentPlayerId ?? null;

  const currentRoomRef = useRef<Room | null>(null);
  const legacyRoomEventSkipRef = useRef<{
    roomId: string | null;
    roomUpdated: boolean;
    updatePlayers: boolean;
    roomPlaying: boolean;
  }>({
    roomId: null,
    roomUpdated: false,
    updatePlayers: false,
    roomPlaying: false,
  });
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const markRoomSyncHandled = useCallback((roomId: string) => {
    legacyRoomEventSkipRef.current = {
      roomId,
      roomUpdated: true,
      updatePlayers: true,
      roomPlaying: true,
    };
  }, []);

  const shouldSkipLegacyRoomUpdated = useCallback((roomId: string) => {
    const state = legacyRoomEventSkipRef.current;
    if (state.roomId !== roomId || !state.roomUpdated) {
      return false;
    }

    state.roomUpdated = false;
    if (!state.updatePlayers && !state.roomPlaying) {
      state.roomId = null;
    }
    return true;
  }, []);

  const shouldSkipLegacyUpdatePlayers = useCallback((roomId: string | null) => {
    const state = legacyRoomEventSkipRef.current;
    if (!state.updatePlayers) {
      return false;
    }
    if (roomId && state.roomId && state.roomId !== roomId) {
      return false;
    }

    state.updatePlayers = false;
    if (!state.roomUpdated && !state.roomPlaying) {
      state.roomId = null;
    }
    return true;
  }, []);

  const shouldSkipLegacyRoomPlaying = useCallback((roomId: string | null) => {
    const state = legacyRoomEventSkipRef.current;
    if (!state.roomPlaying) {
      return false;
    }
    if (roomId && state.roomId && state.roomId !== roomId) {
      return false;
    }

    state.roomPlaying = false;
    if (!state.roomUpdated && !state.updatePlayers) {
      state.roomId = null;
    }
    return true;
  }, []);

  const clearStoredRoomState = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('roomId');
    }
    setCurrentRoom(null);
  }, []);

  // ルーム一覧の取得
  const fetchRooms = useCallback(() => {
    if (socket) {
      socket.emit('list-rooms');
    }
  }, [socket]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms, users.length]);

  useEffect(() => {
    setIsClient(true);
    if (!socket) return;

    // Named handlers so cleanup only removes THIS hook's listeners (not useGame.ts's).
    // All handlers read currentRoomRef.current (ref, always fresh) so currentRoom is
    // NOT needed in the dependency array — removing it prevents unnecessary re-runs.

    // ルーム一覧の更新
    const handleRoomsList = (rooms: RoomContract[]) => {
      const nextRooms = fromRoomContracts(rooms);
      setAvailableRooms(nextRooms);
      setError(null);
      const storedRoomId =
        typeof window !== 'undefined' ? sessionStorage.getItem('roomId') : null;
      const targetRoomId = currentRoomRef.current?.id ?? storedRoomId;
      if (targetRoomId) {
        const updatedRoom = nextRooms.find(r => r.id === targetRoomId);
        if (updatedRoom) {
          setCurrentRoom(updatedRoom);
        } else if (storedRoomId === targetRoomId) {
          clearStoredRoomState();
        }
      }
    };

    // ルーム更新
    const handleRoomUpdated = (room: RoomContract) => {
      const nextRoom = fromRoomContract(room);
      if (shouldSkipLegacyRoomUpdated(nextRoom.id)) {
        return;
      }
      setAvailableRooms(prevRooms =>
        prevRooms.map((currentRoom) =>
          currentRoom.id === nextRoom.id ? nextRoom : currentRoom,
        ),
      );
      const storedRoomId =
        typeof window !== 'undefined' ? sessionStorage.getItem('roomId') : null;
      if (
        currentRoomRef.current?.id === nextRoom.id ||
        storedRoomId === nextRoom.id
      ) {
        setCurrentRoom(nextRoom);
      }
    };

    const handleRoomSync = (payload: RoomSyncPayload) => {
      const { room: nextRoom } = fromRoomSyncPayload(payload);
      markRoomSyncHandled(nextRoom.id);

      setAvailableRooms(prevRooms =>
        prevRooms.map((currentRoom) =>
          currentRoom.id === nextRoom.id ? nextRoom : currentRoom,
        ),
      );

      const storedRoomId =
        typeof window !== 'undefined' ? sessionStorage.getItem('roomId') : null;
      if (
        currentRoomRef.current?.id === nextRoom.id ||
        storedRoomId === nextRoom.id
      ) {
        setCurrentRoom(nextRoom);
      }
    };

    // プレイヤー参加（ルーム関連）
    const handleRoomPlayerJoined = ({
      playerId,
      roomId,
      isHost,
    }: RoomPlayerJoinedPayload) => {
      setAvailableRooms(prevRooms => {
        const updatedRooms = prevRooms.map(room => {
          if (room.id !== roomId) return room;

          const existingPlayers = room.players.map((p, index) => {
            if (typeof p === 'string') {
              return {
                socketId: '',
                playerId: p,
                name: p,
                hand: [],
                team: (index % 2) as Team,
                isReady: false,
                isHost: room.hostId === p,
                joinedAt: new Date()
              } as RoomPlayer;
            }
            return p;
          });

          // 既存プレイヤーチェック（重複防止）
          const alreadyInRoom = existingPlayers.some(p => p.playerId === playerId);
          if (alreadyInRoom) return room;

          // 空いている席（COMプレースホルダー）を探す
          const comIndex = existingPlayers.findIndex(p => p.isCOM === true && !p.isReady);
          const newPlayer: RoomPlayer = {
            socketId: '',
            playerId,
            name: playerId,
            hand: [],
            team: (existingPlayers.length % 2) as Team,
            isReady: false,
            isHost,
            joinedAt: new Date()
          };

          const updatedPlayers = [...existingPlayers];
          if (comIndex !== -1) {
            updatedPlayers[comIndex] = newPlayer;
          } else {
            updatedPlayers.push(newPlayer);
          }

          const updatedRoom = {
            ...room,
            players: updatedPlayers
          };

          if (currentRoomRef.current?.id === roomId) {
            setCurrentRoom(updatedRoom);
          }

          return updatedRoom;
        });

        return updatedRooms;
      });

      setPlayerReadyStatus(prev => ({
        ...prev,
        [playerId]: false
      }));
    };

    // プレイヤー退出
    const handlePlayerLeft = ({ playerId, roomId }: { playerId: string; roomId: string }) => {
      if (currentRoomRef.current?.id !== roomId) {
        return;
      }

      if (currentPlayerId && currentPlayerId === playerId) {
        setCurrentRoom(null);
      } else {
        setCurrentRoom(prev => {
          if (!prev) return null;

          const updatedPlayers = prev.players.map(p =>
            p.playerId === playerId
              ? {
                  socketId: '',
                  playerId: `com-disconnected-${playerId}`,
                  name: 'COM',
                  hand: [],
                  team: (p.team ?? 0) as Team,
                  isReady: false,
                  isHost: false,
                  isCOM: true,
                  joinedAt: new Date(),
                  isPasser: true,
                  hasBroken: false,
                }
              : p
          );

          if (prev.hostId === playerId) {
            const newHost = updatedPlayers.find(p => !p.isCOM);
            if (newHost) {
              return {
                ...prev,
                players: updatedPlayers.map(p =>
                  p.playerId === newHost.playerId ? { ...p, isHost: true } : p
                ),
                hostId: newHost.playerId,
              };
            }
          }
          return {
            ...prev,
            players: updatedPlayers,
          };
        });
      }

      setPlayerReadyStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[playerId];
        return newStatus;
      });
    };

    // ゲーム開始
    const handleRoomPlaying = ({ players }: RoomPlayingPayload) => {
      if (shouldSkipLegacyRoomPlaying(currentRoomRef.current?.id ?? null)) {
        return;
      }
      if (currentRoomRef.current) {
        const updatedRoom = {
          ...currentRoomRef.current,
          status: RoomStatus.PLAYING,
          players: currentRoomRef.current.players.map(p => {
            const updatedPlayer = players.find(
              (player) => player.playerId === p.playerId,
            );
            return updatedPlayer ? { ...p, hand: updatedPlayer.hand } : p;
          })
        };

        setCurrentRoom(updatedRoom);
        setAvailableRooms(prevRooms => {
          const newRooms = prevRooms.map(room =>
            room.id === currentRoomRef.current!.id ? updatedRoom : room
          );
          return newRooms;
        });
      } else {
        console.log('currentRoom is null when room-playing event received');
      }
    };

    // プレイヤー情報の更新（currentRoom の team 等を同期する）
    const handleUpdatePlayers = (players: PlayerContract[]) => {
      if (shouldSkipLegacyUpdatePlayers(currentRoomRef.current?.id ?? null)) {
        return;
      }
      if (currentRoomRef.current) {
        const updatedRoom = {
          ...currentRoomRef.current,
          players: currentRoomRef.current.players.map(roomPlayer => {
            const updatedPlayer = players.find(p => p.playerId === roomPlayer.playerId);
            if (updatedPlayer) {
              return {
                ...roomPlayer,
                socketId: updatedPlayer.socketId,
                team: updatedPlayer.team,
                name: updatedPlayer.name,
                userId: updatedPlayer.userId,
                isAuthenticated: updatedPlayer.isAuthenticated
              };
            }
            return roomPlayer;
          })
        };

        setCurrentRoom(updatedRoom);
        setAvailableRooms(prevRooms =>
          prevRooms.map(room =>
            room.id === currentRoomRef.current!.id ? updatedRoom : room
          )
        );
      }
    };

    // エラーメッセージ
    const handleErrorMessage = (message: string) => {
      console.warn('[useRoom] error-message received:', {
        message,
        socketId: socket.id,
        currentRoomId: currentRoomRef.current?.id ?? null,
        storedRoomId:
          typeof window !== 'undefined'
            ? sessionStorage.getItem('roomId')
            : null,
      });

      if (message === 'Failed to reconnect') {
        return;
      }

      setError(message);
    };

    const handleSetRoomId = (roomId: string) => {
      console.log('[useRoom] set-room-id received:', {
        roomId,
        socketId: socket.id,
      });
      sessionStorage.setItem('roomId', roomId);
    };

    // 退出後にcurrentRoomをクリアしてJoinボタンを再表示する
    const handleBackToLobby = () => {
      console.warn('[useRoom] back-to-lobby received:', {
        socketId: socket.id,
        currentRoomId: currentRoomRef.current?.id ?? null,
        storedRoomId:
          typeof window !== 'undefined'
            ? sessionStorage.getItem('roomId')
            : null,
      });
      setError(null);
      clearStoredRoomState();
    };

    socket.on('rooms-list', handleRoomsList);
    socket.on('room-sync', handleRoomSync);
    socket.on('room-updated', handleRoomUpdated);
    socket.on('room-player-joined', handleRoomPlayerJoined);
    socket.on('player-left', handlePlayerLeft);
    socket.on('room-playing', handleRoomPlaying);
    socket.on('update-players', handleUpdatePlayers);
    socket.on('error-message', handleErrorMessage);
    socket.on('set-room-id', handleSetRoomId);
    socket.on('back-to-lobby', handleBackToLobby);

    return () => {
      socket.off('rooms-list', handleRoomsList);
      socket.off('room-sync', handleRoomSync);
      socket.off('room-updated', handleRoomUpdated);
      socket.off('room-player-joined', handleRoomPlayerJoined);
      socket.off('player-left', handlePlayerLeft);
      socket.off('room-playing', handleRoomPlaying);
      socket.off('update-players', handleUpdatePlayers);
      socket.off('error-message', handleErrorMessage);
      socket.off('set-room-id', handleSetRoomId);
      socket.off('back-to-lobby', handleBackToLobby);
    };
  }, [
    socket,
    currentPlayerId,
    clearStoredRoomState,
    markRoomSyncHandled,
    shouldSkipLegacyRoomUpdated,
    shouldSkipLegacyUpdatePlayers,
    shouldSkipLegacyRoomPlaying,
  ]);

  // ルーム作成
  const createRoom = useCallback((name: string, pointsToWin: number, teamAssignmentMethod: 'random' | 'host-choice') => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Room name is required');
      return;
    }

    if (!socket?.connected) {
      console.warn('[useRoom] Cannot create room: socket not connected', {
        socketPresent: !!socket,
        socketId: socket?.id ?? null,
        storedRoomId:
          typeof window !== 'undefined'
            ? sessionStorage.getItem('roomId')
            : null,
      });
      setError('Socket not connected');
      return;
    }

    console.log('[useRoom] Creating room:', {
      name: trimmedName,
      pointsToWin,
      teamAssignmentMethod,
      socketConnected: socket.connected,
      socketId: socket.id,
      storedRoomId:
        typeof window !== 'undefined'
          ? sessionStorage.getItem('roomId')
          : null,
    });

    socket.emit(
      'create-room',
      { name: trimmedName, pointsToWin, teamAssignmentMethod },
      (response: { success: boolean; room?: RoomContract; error?: string }) => {
        console.log('[useRoom] create-room ack:', {
          success: response.success,
          roomId: response.room?.id ?? null,
          error: response.error ?? null,
          socketId: socket.id,
        });
        if (response.success && response.room) {
          const nextRoom = fromRoomContract(response.room);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('roomId', nextRoom.id);
          }
          setCurrentRoom(nextRoom);
          return;
        }

        setError(response.error || 'Failed to create room');
      },
    );
  }, [socket]);

  // ルーム参加
  const joinRoom = useCallback((roomId: string) => {
    if (!socket?.connected) {
      setError('Socket not connected');
      return;
    }

    // 認証済みユーザー情報を使用（socket.id に依存しない）
    if (!user) {
      setError('Authentication required to join a room');
      return;
    }

    const displayName = user.profile?.displayName || user.email || 'User';
    const userToJoin = {
      socketId: socket.id ?? '',
      playerId: user.id,  // Supabase userId — must match room.hostId set during createRoom
      name: displayName,
      userId: user.id,
      isAuthenticated: true
    };

    console.log('[useRoom] Joining room:', {
      roomId,
      displayName,
      userId: user.id
    });

    socket.emit(
      'join-room',
      { roomId, user: userToJoin },
      (response: { success: boolean; room?: RoomContract }) => {
      if (response.success && response.room) {
        const nextRoom = fromRoomContract(response.room);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('roomId', nextRoom.id);
        }
        setCurrentRoom(nextRoom);
      }
      },
    );
  }, [socket, user]);

  // ルーム退出
  const leaveRoom = useCallback((roomId: string) => {
    if (!socket) return;

    const room = availableRooms.find(r => r.id === roomId) || currentRoom;
    // userId でマッチング（socket.id は再接続で変わるため使わない）
    const player = room?.players.find(p => user && p.userId === user.id);

    if (!player?.playerId) {
      console.error('[useRoom] Cannot leave room: player not found');
      setError('Player not found in room');
      return;
    }

    socket.emit('leave-room', { roomId, playerId: player.playerId }, (response: { success: boolean; error?: string }) => {
      if (response.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('roomId');
          console.log('[useRoom] Cleared room data');
        }
      } else {
        setError(response.error || 'Failed to leave room');
      }
    });
  }, [socket, currentRoom, availableRooms, user]);

  // 準備状態の切り替え
  const togglePlayerReady = useCallback(() => {
    if (!socket?.connected) {
      setError('Socket is not connected');
      return;
    }

    if (!currentRoom) {
      setError('No room selected');
      return;
    }

    // userId でマッチング（socket.id は再接続で変わるため使わない）
    const player = currentRoom.players.find(p => user && p.userId === user.id);
    if (!player) {
      setError('Player not found7');
      return;
    }
    if (!player.playerId) {
      setError('Player ID is not set');
      return;
    }

    // ローカルの準備状態を即時更新
    setPlayerReadyStatus(prev => ({
      ...prev,
      [player.playerId]: !prev[player.playerId]
    }));

    socket.emit('toggle-player-ready', {
      roomId: currentRoom.id,
      playerId: player.playerId
    });
  }, [socket, currentRoom, user]);

  // ゲーム開始
  const startGameRoom = useCallback(() => {
    if (!socket || !currentRoom) {
      setError('Socket not connected or no room selected');
      return;
    }

    // userId でマッチング（socket.id は再接続で変わるため使わない）
    const player = currentRoom.players.find(p => user && p.userId === user.id);
    if (!player) {
      setError('Player not found8');
      return;
    }

    socket.emit('start-game', {
      roomId: currentRoom.id,
      playerId: player.playerId
    });
  }, [socket, currentRoom, user]);

  // COM追加（残席をCOMで埋める）
  const fillWithCOM = useCallback((roomId: string) => {
    if (!socket) return;
    const room = availableRooms.find(r => r.id === roomId) || currentRoom;
    const player = room?.players.find(p => user && p.userId === user.id);
    if (!player?.playerId) {
      console.error('[useRoom] Cannot fill with COM: player not found');
      return;
    }
    socket.emit('fill-with-com', { roomId, playerId: player.playerId });
  }, [socket, currentRoom, availableRooms, user]);

  // プレイヤーのチーム変更
  const changePlayerTeam = useCallback((roomId: string, teamChanges: { [key: string]: number }): Promise<boolean> => {
    if (!socket) return Promise.resolve(false);

    const room = availableRooms.find(r => r.id === roomId) || currentRoom;
    // userId でマッチング（socket.id は再接続で変わるため使わない）
    const player = room?.players.find(p => user && p.userId === user.id);

    if (!player?.playerId) {
      console.error('[useRoom] Cannot change team: player not found');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      socket.emit('change-player-team', { roomId, playerId: player.playerId, teamChanges }, (response: { success: boolean }) => {
        resolve(response.success);
      });
    });
  }, [socket, currentRoom, availableRooms, user]);

  if (!isClient) {
    return {
      currentRoom: null,
      availableRooms: [],
      error: null,
      createRoom: () => {},
      joinRoom: () => {},
      leaveRoom: () => {},
      togglePlayerReady: () => {},
      startGameRoom: () => {},
      fetchRooms: () => {},
      playerReadyStatus: {},
      changePlayerTeam: () => {},
      fillWithCOM: () => {},
    };
  }

  return {
    currentRoom,
    availableRooms,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    togglePlayerReady,
    startGameRoom,
    fetchRooms,
    playerReadyStatus,
    changePlayerTeam,
    fillWithCOM,
  };
};
