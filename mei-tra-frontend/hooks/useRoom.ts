import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSocket } from '../app/socket';
import { Room, RoomPlayer } from '../types/room.types';
import { useGame } from './useGame';

export const useRoom = () => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socket = getSocket();
  const game = useGame();
  const players = useMemo(() => game?.players || [], [game]);

  // ルーム一覧の取得
  const fetchRooms = useCallback(() => {
    socket.emit('list-rooms');
  }, [socket]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms, players.length]);

  // ルーム作成
  const createRoom = useCallback((name: string) => {
    if (!socket.id) {
      setError('Socket not connected');
      return;
    }
    socket.emit('create-room', { name });
  }, [socket, players]);

  // ルーム参加
  const joinRoom = useCallback((roomId: string) => {
    if (!socket.id) {
      setError('Socket not connected');
      return;
    }
    const socketId = socket.id;
    const player = players.find((p: { id: string }) => p.id === socketId);
    if (!player) {
      setError('Please enter your name and join the game first');
      return;
    }
    if (!player.playerId) {
      setError('Player ID is not set');
      return;
    }
    socket.emit('join-room', { roomId, playerId: player.playerId });
  }, [socket, players]);

  // ルーム退出
  const leaveRoom = useCallback(() => {
    if (currentRoom) {
      socket.emit('leave-room', currentRoom.id, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          setCurrentRoom(null);
        } else {
          setError(response.error || 'Failed to leave room');
        }
      });
    }
  }, [currentRoom, socket]);

  // 準備状態の切り替え
  const toggleReady = useCallback(() => {
    if (currentRoom) {
      socket.emit('toggle-ready', currentRoom.id, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          setError(response.error || 'Failed to toggle ready state');
        }
      });
    }
  }, [currentRoom, socket]);

  useEffect(() => {
    // ルーム一覧の更新
    socket.on('rooms-list', (rooms: Room[]) => {
      setAvailableRooms(rooms);
    });

    // プレイヤー参加
    socket.on('player-joined', ({ playerId, roomId, isHost }: { playerId: string; roomId: string; isHost: boolean }) => {
      console.log('player-joined', playerId, roomId, isHost);
      setCurrentRoom(prev => {
        if (!prev || prev.id !== roomId) {
          return prev;
        }
        const newPlayer: RoomPlayer = {
          id: playerId,
          playerId,
          name: playerId,
          hand: [],
          team: 0,
          isReady: false,
          isHost,
          joinedAt: new Date()
        };
        const updatedRoom = {
          ...prev,
          players: [...prev.players, newPlayer]
        };
        // 4人揃ったらゲーム開始
        if (updatedRoom.players.length === 4) {
          socket.emit('start-game', roomId);
        }
        return updatedRoom;
      });
    });

    // プレイヤー退出
    socket.on('player-left', ({ playerId, roomId }: { playerId: string; roomId: string }) => {
      if (currentRoom?.id === roomId) {
        setCurrentRoom(prev => {
          if (!prev) return null;
          const updatedPlayers = prev.players.filter(p => p.id !== playerId);
          // ホストが退出した場合、新しいホストを設定
          if (prev.hostId === playerId && updatedPlayers.length > 0) {
            const newHost = updatedPlayers[0];
            return {
              ...prev,
              players: updatedPlayers.map(p => 
                p.id === newHost.id ? { ...p, isHost: true } : p
              ),
              hostId: newHost.id
            };
          }
          return {
            ...prev,
            players: updatedPlayers
          };
        });
      }
    });

    // エラーメッセージ
    socket.on('error-message', (message: string) => {
      setError(message);
    });

    return () => {
      socket.off('rooms-list');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('error-message');
    };
  }, [currentRoom, socket]);

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