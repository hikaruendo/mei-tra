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
  const togglePlayerReady = useCallback(() => {
    if (!socket.connected) {
      console.error('Socket is not connected');
      setError('Socket is not connected');
      return;
    }

    if (currentRoom) {
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
      socket.emit('toggle-player-ready', { 
        roomId: currentRoom.id,
        playerId: player.playerId 
      }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          setError(response.error || 'Failed to toggle ready state');
        }
      });
    }
  }, [currentRoom, socket, players]);

  // ゲーム開始
  const toggleReady = useCallback(() => {
    if (currentRoom) {
      const socketId = socket.id;
      const player = players.find((p: { id: string }) => p.id === socketId);
      if (!player) {
        setError('Player not found');
        return;
      }

      // ホストのみがゲームを開始できる
      if (currentRoom.hostId !== player.playerId) {
        setError('Only the host can start the game');
        return;
      }
      
      // 全員が準備完了しているか確認
      const allReady = currentRoom.players.every(player => player.isReady);
      if (!allReady) {
        setError('All players must be ready to start the game');
        return;
      }

      // ゲーム開始
      socket.emit('start-game', { roomId: currentRoom.id }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          setError(response.error || 'Failed to start game');
        }
      });
    }
  }, [currentRoom, socket, players]);

  useEffect(() => {
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
                id: p,
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
            id: playerId,
            playerId,
            name: gamePlayer?.name || playerId,
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

          // 現在のルームを更新
          if (currentRoom?.id === roomId) {
            setCurrentRoom(updatedRoom);
          } else if (!currentRoom) {
            // 新しいルームに参加する場合は、更新されたルーム情報を直接使用
            setCurrentRoom(updatedRoom);
          }

          // 4人揃ったら準備完了状態に
          if (updatedRoom.players.length === 4) {
            // 全員の準備状態をtrueに設定
            updatedRoom.players.forEach(player => {
              player.isReady = true;
            });
            // ルームのステータスをREADYに変更
            socket.emit('update-room-status', { 
              roomId: updatedRoom.id, 
              status: 'ready' 
            });
          }

          return updatedRoom;
        });

        return updatedRooms;
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

    // ゲーム開始
    socket.on('game-started', (players) => {
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
      console.error('Received error message:', message);
      setError(message);
    });

    // 成功レスポンス
    socket.on('start-game-response', (response: { success: boolean }) => {
      if (response.success) {
        setError(null);
      }
    });

    return () => {
      socket.off('rooms-list');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('error-message');
      socket.off('game-started');
      socket.off('start-game-response');
      socket.off('update-phase');
      socket.off('update-turn');
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
    togglePlayerReady,
    fetchRooms
  };
}; 