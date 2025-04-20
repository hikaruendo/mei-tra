import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../app/socket';
import { Room, RoomPlayer } from '../types/room.types';

export const useRoom = () => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socket = getSocket();

  // ルーム一覧の取得
  const fetchRooms = useCallback(() => {
    socket.emit('list-rooms');
  }, [socket]);

  // ルーム作成
  const createRoom = useCallback((name: string) => {
    socket.emit('create-room', { name });
  }, [socket]);

  // ルーム参加
  const joinRoom = useCallback((roomId: string) => {
    socket.emit('join-room', roomId);
  }, [socket]);

  // ルーム退出
  const leaveRoom = useCallback(() => {
    if (currentRoom) {
      socket.emit('leave-room', currentRoom.id);
      setCurrentRoom(null);
    }
  }, [currentRoom, socket]);

  // 準備状態の切り替え
  const toggleReady = useCallback(() => {
    if (currentRoom) {
      socket.emit('toggle-ready', currentRoom.id);
    }
  }, [currentRoom, socket]);

  useEffect(() => {
    // ルーム一覧の更新
    socket.on('rooms-list', (rooms: Room[]) => {
      setAvailableRooms(rooms);
    });

    // ルーム作成成功
    socket.on('room-created', (room: Room) => {
      setCurrentRoom(room);
      setError(null);
    });

    // プレイヤー参加
    socket.on('player-joined', ({ playerId, roomId }: { playerId: string; roomId: string }) => {
      if (currentRoom?.id === roomId) {
        setCurrentRoom(prev => {
          if (!prev) return null;
          const newPlayer: RoomPlayer = {
            id: playerId,
            playerId,
            name: playerId,
            hand: [],
            team: 0,
            isReady: false,
            isHost: false,
            joinedAt: new Date()
          };
          return {
            ...prev,
            players: [...prev.players, newPlayer]
          };
        });
      }
    });

    // プレイヤー退出
    socket.on('player-left', ({ playerId, roomId }: { playerId: string; roomId: string }) => {
      if (currentRoom?.id === roomId) {
        setCurrentRoom(prev => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.filter(p => p.id !== playerId)
          };
        });
      }
    });

    // エラーメッセージ
    socket.on('error-message', (message: string) => {
      setError(message);
    });

    // 初期ルーム一覧の取得
    fetchRooms();

    return () => {
      socket.off('rooms-list');
      socket.off('room-created');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('error-message');
    };
  }, [currentRoom, fetchRooms, socket]);

  return {
    currentRoom,
    availableRooms,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    fetchRooms
  };
}; 