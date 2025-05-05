import { Injectable } from '@nestjs/common';
import { Room, RoomRepository, RoomPlayer } from '../types/room.types';
import { RoomStatus } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { GameStateFactory } from './game-state.factory';
import { Player, User, Team } from '../types/game.types';

@Injectable()
export class RoomService implements RoomRepository {
  private rooms: Map<string, Room> = new Map();
  private roomGameStates: Map<string, GameStateService> = new Map();
  // 退出席情報（ルームIDごとに席番号ベースでhand/teamを保存）
  private vacantSeats: Record<
    string,
    Record<number, { hand: string[]; team: Team }>
  > = {};

  constructor(private readonly gameStateFactory: GameStateFactory) {}

  createRoom(room: Room): Promise<Room> {
    this.rooms.set(room.id, room);
    return Promise.resolve(room);
  }

  getRoom(roomId: string): Promise<Room | null> {
    return Promise.resolve(this.rooms.get(roomId) || null);
  }

  updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null> {
    const room = this.rooms.get(roomId);
    if (!room) return Promise.resolve(null);

    const updatedRoom = { ...room, ...updates };
    this.rooms.set(roomId, updatedRoom);
    return Promise.resolve(updatedRoom);
  }

  deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    this.roomGameStates.delete(roomId);
    return Promise.resolve();
  }

  listRooms(): Promise<Room[]> {
    return Promise.resolve(Array.from(this.rooms.values()));
  }

  createNewRoom(name: string, hostId: string): Promise<Room> {
    const room: Room = {
      id: this.generateRoomId(),
      name,
      hostId,
      status: RoomStatus.WAITING,
      players: [],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random',
        pointsToWin: 10,
        allowSpectators: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rooms.set(room.id, room);

    // ルームごとに新しいゲーム状態を作成
    const gameState = this.gameStateFactory.createGameState();
    this.roomGameStates.set(room.id, gameState);

    return Promise.resolve(room);
  }

  private createDummyPlayer(index: number): RoomPlayer {
    return {
      id: `dummy-${index}`,
      playerId: `dummy-${index}`,
      name: 'Vacant',
      hand: [],
      team: 0 as Team,
      isReady: false,
      isHost: false,
      joinedAt: new Date(),
      isPasser: false,
      hasBroken: false,
    } as RoomPlayer;
  }

  async leaveRoom(roomId: string, playerId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    // ゲーム中かどうかで分岐
    const isGameStarted = room.status === RoomStatus.PLAYING;
    const gameState = this.roomGameStates.get(roomId);

    if (!gameState) {
      return false;
    }

    if (isGameStarted) {
      // hand情報をgameStateから同期
      const state = gameState.getState();
      room.players.forEach((roomPlayer) => {
        const statePlayer = state.players.find(
          (p) => p.playerId === roomPlayer.playerId,
        );
        if (statePlayer) {
          roomPlayer.hand = [...statePlayer.hand];
        }
      });
      // 退出したプレイヤーのindexを記録
      const playerIndex = room.players.findIndex(
        (p) => p.playerId === playerId,
      );
      if (playerIndex !== -1) {
        if (!this.vacantSeats[roomId]) this.vacantSeats[roomId] = {};
        this.vacantSeats[roomId][playerIndex] = {
          hand: [...room.players[playerIndex].hand],
          team: room.players[playerIndex].team,
        };
        // プレイヤーをダミーに置き換え
        room.players[playerIndex] = this.createDummyPlayer(playerIndex);
      }
    } else {
      // ロビー状態なら単純に配列からremove
      room.players = room.players.filter((p) => p.playerId !== playerId);
      // gameStateのplayersからも削除
      const state = gameState.getState();
      state.players = state.players.filter((p) => p.playerId !== playerId);
    }
    room.updatedAt = new Date();

    if (isGameStarted) {
      const gameState = this.roomGameStates.get(roomId);
      if (gameState) {
        const state = gameState.getState();
        const gsIndex = state.players.findIndex((p) => p.playerId === playerId);
        if (gsIndex !== -1) {
          state.players[gsIndex] = this.createDummyPlayer(gsIndex);
        }
      }
    }

    // If all players are dummies, delete the room
    if (room.players.every((p) => p.playerId.startsWith('dummy-'))) {
      await this.deleteRoom(roomId);
      return true;
    }

    // If host left, assign new host
    if (room.hostId === playerId) {
      const newHost = room.players.find(
        (p) => !p.playerId.startsWith('dummy-'),
      );
      if (newHost) {
        room.hostId = newHost.playerId;
        newHost.isHost = true;
      }
    }

    await this.updateRoom(roomId, room);
    return true;
  }

  async joinRoom(roomId: string, user: User): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    // Check if room is full (excluding dummy players)
    const actualPlayerCount = this.countActualPlayers(room.players);
    if (actualPlayerCount >= room.settings.maxPlayers) {
      return false;
    }

    // Check if player is already in the room
    const existingPlayer = room.players.find(
      (p) => p.playerId === user.playerId,
    );
    if (existingPlayer) {
      return true;
    }

    // 空席があればそこに割り当て
    const roomVacant = this.vacantSeats[roomId] || {};
    const vacantIndexes = Object.keys(roomVacant).map(Number);
    let assignedIndex = -1;
    let hand: string[] = [];
    let team: Team = 0 as Team;

    if (vacantIndexes.length > 0) {
      assignedIndex = vacantIndexes[0];
      hand = roomVacant[assignedIndex].hand;
      team = roomVacant[assignedIndex].team;
      // 使い終わったら削除
      delete roomVacant[assignedIndex];
      if (Object.keys(roomVacant).length === 0) delete this.vacantSeats[roomId];
    } else {
      // チーム自動割り当て
      const team0Count = room.players.filter(
        (p) => !p.playerId.startsWith('dummy-') && p.team === 0,
      ).length;
      const team1Count = room.players.filter(
        (p) => !p.playerId.startsWith('dummy-') && p.team === 1,
      ).length;
      team = (team0Count <= team1Count ? 0 : 1) as Team;
    }

    const player: Player = {
      ...user,
      team,
      hand,
      isPasser: false,
      hasBroken: false,
    };

    // 空席があればそのindexに挿入、なければpush
    if (assignedIndex !== -1) {
      room.players[assignedIndex] = {
        ...player,
        isReady: false,
        isHost: false,
        joinedAt: new Date(),
      };
    } else {
      // ダミープレイヤーの席を探す
      const dummyIndex = room.players.findIndex((p) =>
        p.playerId.startsWith('dummy-'),
      );
      if (dummyIndex !== -1) {
        room.players[dummyIndex] = {
          ...player,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        };
      } else {
        room.players.push({
          ...player,
          isReady: false,
          isHost: false,
          joinedAt: new Date(),
        });
      }
    }
    room.updatedAt = new Date();

    // Update game state if it exists
    const gameState = this.roomGameStates.get(roomId);
    if (gameState) {
      const state = gameState.getState();
      if (assignedIndex !== -1) {
        state.players[assignedIndex] = player;
      } else {
        const dummyIndex = state.players.findIndex((p) =>
          p.playerId.startsWith('dummy-'),
        );
        if (dummyIndex !== -1) {
          state.players[dummyIndex] = player;
        } else {
          state.players.push(player);
        }
      }
    }

    await this.updateRoom(roomId, room);
    return true;
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  async updateRoomStatus(roomId: string, status: RoomStatus): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    // ステータスの遷移チェック
    if (!this.isValidStatusTransition(room.status, status)) {
      return false;
    }

    room.status = status;
    room.updatedAt = new Date();
    await this.updateRoom(roomId, room);
    return true;
  }

  private isValidStatusTransition(
    currentStatus: RoomStatus,
    newStatus: RoomStatus,
  ): boolean {
    const validTransitions: Record<RoomStatus, RoomStatus[]> = {
      [RoomStatus.WAITING]: [RoomStatus.READY, RoomStatus.ABANDONED],
      [RoomStatus.READY]: [
        RoomStatus.PLAYING,
        RoomStatus.WAITING,
        RoomStatus.ABANDONED,
      ],
      [RoomStatus.PLAYING]: [RoomStatus.FINISHED, RoomStatus.ABANDONED],
      [RoomStatus.FINISHED]: [RoomStatus.WAITING, RoomStatus.ABANDONED],
      [RoomStatus.ABANDONED]: [RoomStatus.WAITING],
    };

    return validTransitions[currentStatus].includes(newStatus);
  }

  private countActualPlayers(players: RoomPlayer[]): number {
    return players.filter((p) => !p.playerId.startsWith('dummy-')).length;
  }

  async canStartGame(
    roomId: string,
  ): Promise<{ canStart: boolean; reason?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { canStart: false, reason: 'Room not found' };
    }

    // ステータスチェック
    if (room.status !== RoomStatus.READY) {
      return { canStart: false, reason: 'Room is not ready' };
    }

    // プレイヤー数チェック（ダミーを除く）
    const actualPlayerCount = this.countActualPlayers(room.players);
    if (actualPlayerCount !== room.settings.maxPlayers) {
      return { canStart: false, reason: 'Not enough players' };
    }

    // 全員の準備状態チェック（ダミーを除く）
    const allReady = room.players
      .filter((p) => !p.playerId.startsWith('dummy-'))
      .every((player) => player.isReady);
    if (!allReady) {
      return { canStart: false, reason: 'Not all players are ready' };
    }

    return { canStart: true };
  }

  getRoomGameState(roomId: string): Promise<GameStateService> {
    const gameState = this.roomGameStates.get(roomId);
    if (!gameState) {
      throw new Error(`Game state not found for room ${roomId}`);
    }
    return Promise.resolve(gameState);
  }

  async handlePlayerReconnection(
    roomId: string,
    playerId: string,
    socketId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in room' };
    }

    // Update player's socket ID
    player.id = socketId;

    // Update room
    await this.updateRoom(roomId, room);

    // Get room's game state
    const roomGameState = await this.getRoomGameState(roomId);
    if (roomGameState) {
      // Update player's socket ID in game state
      roomGameState.updatePlayerSocketId(playerId, socketId);
    }

    return { success: true };
  }
}
