import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSocket } from './useSocket';
import { Room, RoomPlayer } from '../types/room.types';
import { useGame } from './useGame';
import { useAuth } from '../contexts/AuthContext';
import { Player, Team } from '../types/game.types';
import { RoomStatus } from '../types/room.types';

export const useRoom = () => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playerReadyStatus, setPlayerReadyStatus] = useState<Record<string, boolean>>({});
  const [isClient, setIsClient] = useState(false);
  const game = useGame();
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const users = useMemo(() => game?.users || [], [game?.users]);
  const players = useMemo(() => game?.players || [], [game?.players]);
  const guestName = game?.name || '';

  const currentRoomRef = useRef<Room | null>(null);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

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
    
    // ルーム一覧の更新
    socket.on('rooms-list', (rooms: Room[]) => {
      setAvailableRooms(rooms);
      
      // 自分のルームが一覧にある場合は同期
      if (currentRoomRef.current) {
        const updatedRoom = rooms.find(r => r.id === currentRoomRef.current?.id);
        if (updatedRoom) {
          setCurrentRoom(updatedRoom);
        }
      }
    });

    // ルーム更新
    socket.on('room-updated', (room: Room) => {
      setAvailableRooms(prevRooms => prevRooms.map(r => r.id === room.id ? room : r));
      if (currentRoomRef.current?.id === room.id) {
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

          // 空いている席（ダミープレイヤー）を探す
          const dummyIndex = existingPlayers.findIndex(p => p.playerId.startsWith('dummy-'));
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

          const updatedPlayers = [...existingPlayers];
          if (dummyIndex !== -1) {
            updatedPlayers[dummyIndex] = newPlayer;
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
    });

    // プレイヤー退出
    socket.on('player-left', ({ playerId, roomId }: { playerId: string; roomId: string }) => {
      if (currentRoomRef.current?.id === roomId) {
        // Only set currentRoom to null if the current user is the one who left
        if (players.find(p => p.playerId === playerId)) {
          setCurrentRoom(null);
        } else {
          setCurrentRoom(prev => {
            if (!prev) return null;

            // 退出するプレイヤーのチーム情報を保持
            const leavingPlayer = prev.players.find(p => p.playerId === playerId);
            const teamAssignments = {
              ...prev.teamAssignments
            };
            
            // チーム情報が存在する場合のみ追加
            if (leavingPlayer?.team !== undefined) {
              teamAssignments[playerId] = leavingPlayer.team;
            }

            const updatedPlayers = prev.players.map(p => 
              p.playerId === playerId 
                ? {
                    id: `dummy-${prev.players.indexOf(p)}`,
                    playerId: `dummy-${prev.players.indexOf(p)}`,
                    name: 'Vacant',
                    hand: [],
                    team: 0 as Team,
                    isReady: false,
                    isHost: false,
                    joinedAt: new Date(),
                    isPasser: false,
                    hasBroken: false,
                  }
                : p
            );
            
            if (prev.hostId === playerId) {
              const newHost = updatedPlayers.find(p => !p.playerId.startsWith('dummy-'));
              if (newHost) {
                return {
                  ...prev,
                  players: updatedPlayers.map(p => 
                    p.playerId === newHost.playerId ? { ...p, isHost: true } : p
                  ),
                  hostId: newHost.playerId,
                  teamAssignments
                };
              }
            }
            return {
              ...prev,
              players: updatedPlayers,
              teamAssignments
            };
          });
        }

        setPlayerReadyStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[playerId];
          return newStatus;
        });
      }
    });

    // ゲーム開始
    socket.on('room-playing', (players: Player[]) => {   
      // #ここで手札が更新される
      if (currentRoomRef.current) {
        const updatedRoom = {
          ...currentRoomRef.current,
          status: RoomStatus.PLAYING,
          players: currentRoomRef.current.players.map(p => {
            const updatedPlayer = players.find((rp: Player) => rp.playerId === p.playerId);
            return updatedPlayer ? { ...p, hand: updatedPlayer.hand } : p;
          })
        };
        
        // 状態更新を一括で行う
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
    });

    // プレイヤー情報の更新
    socket.on('update-players', (players: Player[]) => {
      // 現在参加しているルームのプレイヤー情報を更新
      if (currentRoomRef.current) {
        const updatedRoom = {
          ...currentRoomRef.current,
          players: currentRoomRef.current.players.map(roomPlayer => {
            // Socket IDでマッチングして更新されたプレイヤー情報を適用
            const updatedPlayer = players.find(p => p.id === roomPlayer.id);
            if (updatedPlayer) {
              return {
                ...roomPlayer,
                name: updatedPlayer.name,
                userId: updatedPlayer.userId,
                isAuthenticated: updatedPlayer.isAuthenticated
              };
            }
            return roomPlayer;
          })
        };

        setCurrentRoom(updatedRoom);

        // availableRoomsも同じように更新
        setAvailableRooms(prevRooms =>
          prevRooms.map(room =>
            room.id === currentRoomRef.current!.id ? updatedRoom : room
          )
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
      socket.off('update-players');
      socket.off('error-message');
      socket.off('room-playing');
      socket.off('room-updated');
      socket.off('set-room-id');
    };
  }, [socket, currentRoom, players]);

  // ルーム作成
  const createRoom = useCallback((name: string, pointsToWin: number, teamAssignmentMethod: 'random' | 'host-choice') => {
    if (!socket?.id) {
      setError('Socket not connected');
      return;
    }

    console.log('[useRoom] Creating room:', {
      name,
      pointsToWin,
      teamAssignmentMethod,
      socketId: socket.id,
      socketAuth: socket.auth,
      socketConnected: socket.connected
    });

    socket.emit('create-room', { name, pointsToWin, teamAssignmentMethod });
  }, [socket]);

  // ルーム参加
  const joinRoom = useCallback((roomId: string) => {
    if (!socket?.id) {
      setError('Socket not connected');
      return;
    }
    const socketId = socket.id;
    let userToJoin = users.find((p: { id: string }) => p.id === socketId);

    // 認証済みユーザーの場合、認証情報を適切に設定
    if (user && !userToJoin) {
      const displayName = user.profile?.displayName || user.email || 'User';
      userToJoin = {
        id: socketId,
        playerId: socketId, // 仮のplayerId、サーバーで適切に処理される
        name: displayName,
        userId: user.id,
        isAuthenticated: true
      };

      console.log('[useRoom] Creating user object for authenticated user:', {
        socketId,
        displayName,
        userId: user.id
      });
    }

    if (!userToJoin) {
      if (guestName) {
        let reconnectToken = '';
        try {
          reconnectToken = sessionStorage.getItem('reconnectToken') || '';
        } catch (error) {
          console.warn('[useRoom] Failed to read reconnectToken from sessionStorage:', error);
        }

        userToJoin = {
          id: socketId,
          playerId: reconnectToken || socketId,
          name: guestName,
          isAuthenticated: false
        };
      } else {
        setError('Please enter your name and join the game first');
        return;
      }
    }

    console.log('[useRoom] Joining room:', {
      roomId,
      user: userToJoin,
      socketId,
      isAuthenticated: !!user
    });

    socket.emit('join-room', { roomId, user: userToJoin }, (response: { success: boolean; room?: Room }) => {
      if (response.success && response.room) {
        setCurrentRoom(response.room);
      }
    });
  }, [socket, users, user, guestName]);

  // ルーム退出
  const leaveRoom = useCallback((roomId: string) => {
    if (!socket) return;

    socket.emit('leave-room', { roomId }, (response: { success: boolean; error?: string }) => {
      if (response.success) {
        // Clear reconnection data from sessionStorage to allow fresh rejoin
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('reconnectToken');
          sessionStorage.removeItem('roomId');
          sessionStorage.removeItem('playerName');
          console.log('[useRoom] Cleared reconnection data from sessionStorage');
        }
      } else {
        setError(response.error || 'Failed to leave room');
      }
    });
  }, [socket]);

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

    const socketId = socket.id;
    const player = players.find((p: { id: string }) => p.id === socketId);
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
  }, [socket, currentRoom, players]);

  // ゲーム開始
  const startGameRoom = useCallback(() => {
    if (!socket || !currentRoom) {
      setError('Socket not connected or no room selected');
      return;
    }

    const socketId = socket.id;
    const player = players.find(p => p.id === socketId);
    if (!player) {
      setError('Player not found8');
      return;
    }

    // 全員が準備完了しているか確認
    const allReady = currentRoom.players.every(player => player.isReady);
    if (!allReady) {
      setError('All players must be ready to start the game');
      return;
    }

    socket.emit('start-game', { roomId: currentRoom.id });
  }, [socket, currentRoom, players]);

  // プレイヤーのチーム変更
  const changePlayerTeam = useCallback((roomId: string, teamChanges: { [key: string]: number }): Promise<boolean> => {
    if (!socket) return Promise.resolve(false);

    return new Promise((resolve) => {
      socket.emit('change-player-team', { roomId, teamChanges }, (response: { success: boolean }) => {
        resolve(response.success);
      });
    });
  }, [socket]);

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
  };
};
