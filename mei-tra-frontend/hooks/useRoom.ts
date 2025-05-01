import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSocket } from '../app/socket';
import { Room, RoomPlayer } from '../types/room.types';
import { useGame } from './useGame';
import { Team } from '../types/game.types';
import { RoomStatus } from '../types/room.types';

export const useRoom = () => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playerReadyStatus, setPlayerReadyStatus] = useState<Record<string, boolean>>({});
  const [isClient, setIsClient] = useState(false);
  const game = useGame();
  
  const users = useMemo(() => game?.users || [], [game?.users]);
  const players = useMemo(() => game?.players || [], [game?.players]);

  // ルーム一覧の取得
  const fetchRooms = useCallback(() => {
    const socket = getSocket();
    socket.emit('list-rooms');
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms, users.length]);

  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();
    
    // ルーム一覧の更新
    socket.on('rooms-list', (rooms: Room[]) => {
      setAvailableRooms(rooms);
    });

    // ルーム更新
    socket.on('room-updated', (room: Room) => {
      setAvailableRooms(prevRooms => prevRooms.map(r => r.id === room.id ? room : r));
      if (currentRoom?.id === room.id) {
        setCurrentRoom(room);
      }
    });

    // プレイヤー参加（ルーム関連）
    socket.on('room-player-joined', ({ playerId, roomId, isHost }: { playerId: string; roomId: string; isHost: boolean }) => {
      setAvailableRooms(prevRooms => {
        const updatedRooms = prevRooms.map(room => {
          if (room.id !== roomId) return room;

          const existingPlayers = room.players.map((p, index) => {
            if (typeof p === 'string') {
              return {
                id: p,
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

          const newPlayer: RoomPlayer = {
            id: playerId,
            playerId,
            name: playerId,
            hand: [],
            team: (existingPlayers.length % 2) as Team,
            isReady: false,
            isHost,
            joinedAt: new Date()
          };

          const updatedRoom = {
            ...room,
            players: [...existingPlayers, newPlayer]
          };

          if (currentRoom?.id === roomId) {
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
    });

    // プレイヤー退出
    socket.on('player-left', ({ playerId, roomId }: { playerId: string; roomId: string }) => {
      if (currentRoom?.id === roomId) {
        setCurrentRoom(prev => {
          if (!prev) return null;
          const updatedPlayers = prev.players.filter(p => p.playerId !== playerId);
          if (prev.hostId === playerId && updatedPlayers.length > 0) {
            const newHost = updatedPlayers[0];
            return {
              ...prev,
              players: updatedPlayers.map(p => 
                p.playerId === newHost.playerId ? { ...p, isHost: true } : p
              ),
              hostId: newHost.playerId
            };
          }
          return {
            ...prev,
            players: updatedPlayers
          };
        });

        setPlayerReadyStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[playerId];
          return newStatus;
        });
      }
    });

    // ゲーム開始
    socket.on('room-playing', (players) => {
      if (currentRoom) {
        const updatedRoom = {
          ...currentRoom,
          status: RoomStatus.PLAYING,
          players: players
        };
        setCurrentRoom(updatedRoom);
        setAvailableRooms(prevRooms => 
          prevRooms.map(room => room.id === currentRoom.id ? updatedRoom : room)
        );
      }
    });

    // エラーメッセージ
    socket.on('error-message', (message: string) => {
      setError(message);
    });

    socket.on('set-room-id', (roomId: string) => {
      sessionStorage.setItem('roomId', roomId);
    });

    return () => {
      socket.off('rooms-list');
      socket.off('room-player-joined');
      socket.off('player-left');
      socket.off('error-message');
      socket.off('room-playing');
      socket.off('room-updated');
      socket.off('set-room-id');
    };
  }, [currentRoom]);

  // ルーム作成
  const createRoom = useCallback((name: string) => {
    const socket = getSocket();
    if (!socket.id) {
      setError('Socket not connected');
      return;
    }
    socket.emit('create-room', { name });
  }, []);

  // ルーム参加
  const joinRoom = useCallback((roomId: string) => {
    const socket = getSocket();
    if (!socket.id) {
      setError('Socket not connected');
      return;
    }
    const socketId = socket.id;
    const user = users.find((p: { id: string }) => p.id === socketId);
    if (!user) {
      setError('Please enter your name and join the game first');
      return;
    }
    socket.emit('join-room', { roomId, user }, (response: { success: boolean; room?: Room }) => {
      if (response.success && response.room) {
        setCurrentRoom(response.room);
      }
    });
  }, [users]);

  // ルーム退出
  const leaveRoom = useCallback((roomId: string) => {
    const socket = getSocket();
    if (!currentRoom) {
      setError('No room selected');
      return;
    }
    socket.emit('leave-room', { roomId }, (response: { success: boolean; error?: string }) => {
      if (response.success) {
        setCurrentRoom(null);
        setPlayerReadyStatus({});
      } else {
        setError(response.error || 'Failed to leave room');
      }
    });
  }, [currentRoom]);

  // 準備状態の切り替え
  const togglePlayerReady = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) {
      setError('Socket is not connected');
      return;
    }

    if (!currentRoom) {
      setError('No room selected');
      return;
    }

    const socketId = socket.id;
    const player = players.find((p: { id: string }) => p.id === socketId);
    if (!player) {
      setError('Player not found');
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
  }, [currentRoom, players]);

  // ゲーム開始
  const startGameRoom = useCallback(() => {
    const socket = getSocket();
    if (!currentRoom) {
      setError('No room selected');
      return;
    }
  
    const socketId = socket.id;
    const player = players.find(p => p.id === socketId);
    if (!player) {
      setError('Player not found');
      return;
    }
  
    // 全員が準備完了しているか確認
    const allReady = currentRoom.players.every(player => player.isReady);
    if (!allReady) {
      setError('All players must be ready to start the game');
      return;
    }
  
    socket.emit('start-game', { roomId: currentRoom.id });
  }, [currentRoom, players]);

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
      playerReadyStatus: {}
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
    playerReadyStatus
  };
}; 