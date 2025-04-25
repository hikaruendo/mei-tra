import { Injectable } from '@nestjs/common';
import { Room, RoomRepository } from '../types/room.types';
import { RoomStatus } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { GameStateFactory } from './game-state.factory';
import { Player } from 'src/types/game.types';

@Injectable()
export class RoomService implements RoomRepository {
  private rooms: Map<string, Room> = new Map();
  private roomGameStates: Map<string, GameStateService> = new Map();

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

  async joinRoom(roomId: string, player: Player): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room || room.players.length >= room.settings.maxPlayers) {
      return false;
    }

    // Check if player already exists in the room
    if (room.players.some((p) => p.id === player.playerId)) {
      return true;
    }

    // Add player to the room
    room.players.push({
      ...player,
      isReady: false,
      isHost: false,
      joinedAt: new Date(),
    });
    room.updatedAt = new Date();
    await this.updateRoom(roomId, room);

    const gameState = this.roomGameStates.get(roomId);
    if (gameState) {
      const state = gameState.getState();
      state.players.push({
        ...player,
      });
    }
    return true;
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  async togglePlayerReady(roomId: string, playerId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return false;
    }

    // 準備状態を切り替え
    player.isReady = !player.isReady;
    room.updatedAt = new Date();

    // 全員が準備完了したらルームのステータスを更新
    const allReady = room.players.every((p) => p.isReady);
    if (allReady && room.players.length === room.settings.maxPlayers) {
      room.status = RoomStatus.READY;
    } else {
      room.status = RoomStatus.WAITING;
    }

    await this.updateRoom(roomId, room);
    return true;
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

    // プレイヤー数チェック
    if (room.players.length !== room.settings.maxPlayers) {
      return { canStart: false, reason: 'Not enough players' };
    }

    // 全員の準備状態チェック
    const allReady = room.players.every((player) => player.isReady);
    if (!allReady) {
      return { canStart: false, reason: 'Not all players are ready' };
    }

    return { canStart: true };
  }

  getRoomGameState(roomId: string): Promise<GameStateService> {
    const gameState = this.roomGameStates.get(roomId);
    if (!gameState) {
      throw new Error('Game state not found for room');
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

    const player = room.players.find((p) => p.id === playerId);
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
