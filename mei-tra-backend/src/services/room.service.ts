import { Injectable, Inject, Logger } from '@nestjs/common';
import { Room, RoomPlayer } from '../types/room.types';
import { RoomStatus } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { GameStateFactory } from './game-state.factory';
import { User, Team } from '../types/game.types';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { IRoomService } from './interfaces/room-service.interface';

@Injectable()
export class RoomService implements IRoomService {
  private readonly logger = new Logger(RoomService.name);
  private roomGameStates: Map<string, GameStateService> = new Map();
  // 退出席情報（ルームIDごとに席番号ベースでhand/teamを保存）
  private vacantSeats: Record<
    string,
    Record<number, { hand: string[]; team: Team }>
  > = {};

  private readonly ROOM_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24時間
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1時間

  constructor(
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly gameStateFactory: GameStateFactory,
  ) {
    // 定期的なクリーンアップを開始
    this.startCleanupTask();
  }

  private startCleanupTask() {
    setInterval(() => {
      void this.cleanupRooms();
    }, this.CLEANUP_INTERVAL);
  }

  private async cleanupRooms() {
    try {
      const now = new Date();
      const expiryTime = now.getTime() - this.ROOM_EXPIRY_TIME;

      // Find rooms older than expiry time
      const expiredRooms = await this.roomRepository.findRoomsOlderThan(
        new Date(expiryTime),
      );

      for (const room of expiredRooms) {
        // Check deletion conditions
        if (
          room.status === RoomStatus.FINISHED ||
          room.status === RoomStatus.ABANDONED ||
          now.getTime() - room.lastActivityAt.getTime() > this.ROOM_EXPIRY_TIME
        ) {
          await this.deleteRoom(room.id);
        }
      }
    } catch (error) {
      console.error('Error during room cleanup:', error);
    }
  }

  private updateRoomActivity(roomId: string) {
    return this.roomRepository.updateLastActivity(roomId);
  }

  async createRoom(room: Room): Promise<Room> {
    const createdRoom = await this.roomRepository.create(room);
    return createdRoom;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return this.roomRepository.findById(roomId);
  }

  async updateRoom(
    roomId: string,
    updates: Partial<Room>,
  ): Promise<Room | null> {
    const updatedRoom = await this.roomRepository.update(roomId, updates);
    if (updatedRoom) {
      await this.updateRoomActivity(roomId);
    }
    return updatedRoom;
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.roomRepository.delete(roomId);
    this.roomGameStates.delete(roomId);
    delete this.vacantSeats[roomId];
  }

  async listRooms(): Promise<Room[]> {
    return this.roomRepository.findAll();
  }

  async createNewRoom(
    name: string,
    hostId: string,
    pointsToWin: number,
    teamAssignmentMethod: 'random' | 'host-choice',
  ): Promise<Room> {
    const room: Room = {
      id: '', // データベースでUUIDが自動生成される
      name,
      hostId,
      status: RoomStatus.WAITING,
      players: [],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod,
        pointsToWin,
        allowSpectators: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    const createdRoom = await this.roomRepository.create(room);

    // ルームごとに新しいゲーム状態を作成
    const gameState = this.gameStateFactory.createGameState();
    gameState.setRoomId(createdRoom.id);
    await gameState.loadState(createdRoom.id);

    // Configure game settings with the room's pointsToWin
    await gameState.configureGameSettings(pointsToWin);

    this.roomGameStates.set(createdRoom.id, gameState);

    return createdRoom;
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
        const dummyPlayer = this.createDummyPlayer(playerIndex);
        room.players[playerIndex] = dummyPlayer;

        // データベースでは元のプレイヤーを削除してダミープレイヤーを追加
        await this.roomRepository.removePlayer(roomId, playerId);
        await this.roomRepository.addPlayer(roomId, dummyPlayer);

        // ゲーム状態も同時に更新
        const gsIndex = state.players.findIndex((p) => p.playerId === playerId);
        if (gsIndex !== -1) {
          state.players[gsIndex] = this.createDummyPlayer(gsIndex);
        }

        // 再接続トークンも削除
        gameState.removePlayerToken(playerId);
      }
    } else {
      // ロビー状態なら単純に配列からremove
      room.players = room.players.filter((p) => p.playerId !== playerId);
      // データベースからも削除
      await this.roomRepository.removePlayer(roomId, playerId);
      // gameStateのplayersからも削除
      const state = gameState.getState();
      state.players = state.players.filter((p) => p.playerId !== playerId);
      // 再接続トークンも削除
      gameState.removePlayerToken(playerId);
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
        // データベースのホスト情報も更新
        await this.roomRepository.updatePlayer(roomId, newHost.playerId, {
          isHost: true,
        });
        // ルームのhostIdのみ更新（プレイヤー情報は再取得しない）
        await this.roomRepository.update(roomId, { hostId: newHost.playerId });
      }
    }

    // アクティビティ時刻のみ更新（プレイヤー情報の再取得を避ける）
    await this.updateRoomActivity(roomId);
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
    let replacingDummyId: string | null = null;

    if (vacantIndexes.length > 0) {
      assignedIndex = vacantIndexes[0];
      hand = roomVacant[assignedIndex].hand;
      team = roomVacant[assignedIndex].team;
      // 置き換え対象のダミープレイヤーIDを取得
      replacingDummyId = room.players[assignedIndex]?.playerId || null;
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

    const player: RoomPlayer = {
      ...user,
      team,
      hand,
      isPasser: false,
      hasBroken: false,
      isReady: false,
      isHost: false,
      joinedAt: new Date(),
    };

    // データベース操作
    if (replacingDummyId) {
      // ダミープレイヤーを削除して新しいプレイヤーを追加
      await this.roomRepository.removePlayer(roomId, replacingDummyId);
      const addSuccess = await this.roomRepository.addPlayer(roomId, player);
      if (!addSuccess) {
        return false;
      }
    } else {
      // 通常の新規追加
      const addSuccess = await this.roomRepository.addPlayer(roomId, player);
      if (!addSuccess) {
        return false;
      }
    }

    // メモリ上のルームデータを更新
    if (assignedIndex !== -1) {
      room.players[assignedIndex] = player;
    } else {
      // ダミープレイヤーの席を探す
      const dummyIndex = room.players.findIndex((p) =>
        p.playerId.startsWith('dummy-'),
      );
      if (dummyIndex !== -1) {
        room.players[dummyIndex] = player;
      } else {
        room.players.push(player);
      }
    }

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

    // アクティビティ時刻のみ更新（プレイヤー情報の再取得を避ける）
    await this.updateRoomActivity(roomId);
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

    const updatedRoom = await this.updateRoom(roomId, { status });
    await this.updateRoomActivity(roomId);
    return !!updatedRoom;
  }

  async updatePlayerInRoom(
    roomId: string,
    playerId: string,
    updates: Partial<RoomPlayer>,
  ): Promise<boolean> {
    return this.roomRepository.updatePlayer(roomId, playerId, updates);
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

    // ルームのステータスがREADYでない場合は開始できない
    if (room.status !== RoomStatus.READY) {
      return { canStart: false, reason: 'Room is not ready' };
    }

    // 実際のプレイヤー（ダミーを除く）が4人揃っているか確認
    const actualPlayers = room.players.filter(
      (p) => !p.playerId.startsWith('dummy-'),
    );
    if (actualPlayers.length !== 4) {
      return { canStart: false, reason: 'Need exactly 4 players to start' };
    }

    // 全員が準備完了しているか確認
    const allReady = actualPlayers.every((p) => p.isReady);
    if (!allReady) {
      return { canStart: false, reason: 'All players must be ready' };
    }

    return { canStart: true };
  }

  private countActualPlayers(players: RoomPlayer[]): number {
    return players.filter((p) => !p.playerId.startsWith('dummy-')).length;
  }

  async getRoomGameState(roomId: string): Promise<GameStateService> {
    let gameState = this.roomGameStates.get(roomId);
    if (!gameState) {
      gameState = this.gameStateFactory.createGameState();
      gameState.setRoomId(roomId);
      await gameState.loadState(roomId);
      this.roomGameStates.set(roomId, gameState);
    }
    return gameState;
  }

  async handlePlayerReconnection(
    roomId: string,
    playerId: string,
    socketId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Get room's game state first (has the most up-to-date player info)
    const roomGameState = await this.getRoomGameState(roomId);
    if (!roomGameState) {
      return { success: false, error: 'Game state not found' };
    }

    const state = roomGameState.getState();
    const player = state.players.find((p) => p.playerId === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in room' };
    }

    // Update player's socket ID in game state
    void roomGameState.updatePlayerSocketId(playerId, socketId);

    // Update player's socket ID in database directly
    await this.roomRepository.updatePlayer(roomId, playerId, {
      id: socketId,
    });

    return { success: true };
  }

  async updateUserGameStats(
    userId: string,
    won: boolean,
    score: number,
  ): Promise<void> {
    try {
      const profile = await this.userProfileRepository.findById(userId);
      if (!profile) {
        this.logger.warn(`User profile not found for user ${userId}`);
        return;
      }

      const newGamesPlayed = profile.gamesPlayed + 1;
      const newGamesWon = won ? profile.gamesWon + 1 : profile.gamesWon;
      const newTotalScore = profile.totalScore + score;

      await this.userProfileRepository.updateGameStats(
        userId,
        newGamesPlayed,
        newGamesWon,
        newTotalScore,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update game stats for user ${userId}:`,
        error,
      );
    }
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    try {
      await this.userProfileRepository.updateLastSeen(userId);
    } catch (error) {
      this.logger.error(
        `Failed to update last seen for user ${userId}:`,
        error,
      );
    }
  }
}
