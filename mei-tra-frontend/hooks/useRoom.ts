import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSocket } from '../app/socket';
import { Room, RoomPlayer } from '../types/room.types';
import { useGame } from './useGame';
import { Team } from '../types/game.types';

export const useRoom = () => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socket = getSocket();
  const game = useGame();
  const players = useMemo(() => {
    return game?.players || [];
  }, [game?.players]);

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

      // Update available rooms
      setAvailableRooms(prevRooms => {
        const updatedRooms = prevRooms.map(room => {
          if (room.id !== roomId) return room;

          // Get existing players as RoomPlayer objects
          const existingPlayers = room.players.map((p, index) => {
            if (typeof p === 'string') {
              // 既存プレイヤーはplayerIdで検索
              const gamePlayer = players.find(gp => gp.playerId === p);
              return {
                id: p, // playerIdをidとして使用
                playerId: p,
                name: gamePlayer?.name || p,
                hand: [],
                team: (index % 2) as Team,
                isReady: false,
                isHost: room.hostId === p,
                joinedAt: new Date()
              } as RoomPlayer;
            }
            return p;
          });

          // 新規プレイヤーはplayerIdで検索
          const gamePlayer = players.find(p => p.playerId === playerId);
          // Add new player
          const newPlayer: RoomPlayer = {
            id: playerId, // playerIdをidとして使用
            playerId,
            name: gamePlayer?.name || playerId,
            hand: [],
            team: (existingPlayers.length % 2) as Team,
            isReady: false,
            isHost,
            joinedAt: new Date()
          };

          return {
            ...room,
            players: [...existingPlayers, newPlayer]
          };
        });
        return updatedRooms;
      });

      setCurrentRoom(prev => {
        // If we don't have a current room but we're joining one
        if (!prev) {
          console.log('prev1', prev);
          // Find the room in available rooms
          const room = availableRooms.find(r => r.id === roomId);
          if (!room) return null;

          // Convert existing players to RoomPlayer objects
          const existingPlayers = room.players.map((p, index) => {
            if (typeof p === 'string') {
              // 既存プレイヤーはplayerIdで検索
              const gamePlayer = players.find(gp => gp.playerId === p);
              return {
                id: p, // playerIdをidとして使用
                playerId: p,
                name: gamePlayer?.name || p,
                hand: [],
                team: (index % 2) as Team,
                isReady: false,
                isHost: room.hostId === p,
                joinedAt: new Date()
              } as RoomPlayer;
            }
            return p;
          });

          // 新規プレイヤーはplayerIdで検索
          const gamePlayer = players.find(p => p.playerId === playerId);
          // Add new player
          const newPlayer: RoomPlayer = {
            id: playerId, // playerIdをidとして使用
            playerId,
            name: gamePlayer?.name || playerId,
            hand: [],
            team: (existingPlayers.length % 2) as Team,
            isReady: false,
            isHost,
            joinedAt: new Date()
          };

          const newRoom = {
            ...room,
            players: [...existingPlayers, newPlayer]
          };
          return newRoom;
        }

        // If we're already in this room
        if (prev.id !== roomId) {
          console.log('prev2', prev);
          return prev;
        }

        // 新規プレイヤーはplayerIdで検索
        const gamePlayer = players.find(p => p.playerId === playerId);
        const newPlayer: RoomPlayer = {
          id: playerId, // playerIdをidとして使用
          playerId,
          name: gamePlayer?.name || playerId,
          hand: [],
          team: (prev.players.length % 2) as Team,
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
          // 全員の準備状態をtrueに設定
          updatedRoom.players.forEach(player => {
            player.isReady = true;
          });
          // ゲーム開始
          console.log('Emitting start-game event for room:', updatedRoom.id);
          socket.emit('start-game', { roomId: updatedRoom.id });
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
  }, [currentRoom, socket, players]);

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