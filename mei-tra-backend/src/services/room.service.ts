import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { Room, RoomPlayer } from '../types/room.types';
import { RoomStatus } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { GameStateFactory } from './game-state.factory';
import { DomainPlayer, GameState, Team } from '../types/game.types';
import { toDomainPlayer } from '../types/player-adapters';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { IRoomService } from './interfaces/room-service.interface';
import { IComPlayerService } from './interfaces/com-player-service.interface';
import { PlayerReferenceRemapperService } from './player-reference-remapper.service';
import { UserGameStatsService } from './user-game-stats.service';
import { ComSessionService, VacantSeats } from './com-session.service';
import { SeatRestorationService } from './seat-restoration.service';
import { RoomJoinService } from './room-join.service';
import { PlayerConnectionState, SessionUser } from '../types/session.types';

@Injectable()
export class RoomService implements IRoomService, OnModuleDestroy {
  private readonly logger = new Logger(RoomService.name);
  private roomGameStates: Map<string, GameStateService> = new Map();
  // 退出席情報（ルームIDごとに席番号ベースで元プレイヤーのスナップショットを保存）
  private vacantSeats: VacantSeats = {};

  private readonly ROOM_EXPIRY_TIME = 6 * 60 * 60 * 1000; // 6時間
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分
  private cleanupIntervalId: ReturnType<typeof setInterval>;
  private readonly playerReferenceRemapperService: PlayerReferenceRemapperService;
  private readonly userGameStatsService: UserGameStatsService;
  private readonly comSessionService: ComSessionService;
  private readonly seatRestorationService: SeatRestorationService;
  private readonly roomJoinService: RoomJoinService;

  private normalizeRoomHostFlags(room: Room): Room {
    return {
      ...room,
      players: room.players.map((player) => ({
        ...player,
        isHost: player.playerId === room.hostId,
      })),
    };
  }

  constructor(
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly gameStateFactory: GameStateFactory,
    @Inject('IComPlayerService')
    private readonly comPlayerService: IComPlayerService,
    @Optional()
    playerReferenceRemapperService?: PlayerReferenceRemapperService,
    @Optional()
    userGameStatsService?: UserGameStatsService,
    @Optional()
    comSessionService?: ComSessionService,
    @Optional()
    seatRestorationService?: SeatRestorationService,
    @Optional()
    roomJoinService?: RoomJoinService,
  ) {
    this.playerReferenceRemapperService =
      playerReferenceRemapperService ?? new PlayerReferenceRemapperService();
    this.userGameStatsService =
      userGameStatsService ??
      new UserGameStatsService(this.userProfileRepository);
    this.comSessionService =
      comSessionService ??
      new ComSessionService(
        this.roomRepository,
        this.comPlayerService,
        this.playerReferenceRemapperService,
      );
    this.seatRestorationService =
      seatRestorationService ??
      new SeatRestorationService(
        this.roomRepository,
        this.playerReferenceRemapperService,
      );
    this.roomJoinService =
      roomJoinService ??
      new RoomJoinService(
        this.roomRepository,
        this.playerReferenceRemapperService,
      );
    // 定期的なクリーンアップを開始
    this.startCleanupTask();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupIntervalId);
  }

  private startCleanupTask() {
    this.cleanupIntervalId = setInterval(() => {
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
    return this.normalizeRoomHostFlags(createdRoom);
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const room = await this.roomRepository.findById(roomId);
    return room ? this.normalizeRoomHostFlags(room) : null;
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
    const rooms = await this.roomRepository.findAll();
    return rooms
      .map((room) => this.normalizeRoomHostFlags(room))
      .filter((room) => room.players.some((player) => !player.isCOM));
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

  private createCOMPlaceholder(
    index: number | string,
    hand: string[] = [],
  ): RoomPlayer {
    const idStr = String(index);
    return {
      socketId: `com-${idStr}`,
      playerId: `com-${idStr}`,
      name: 'COM',
      isCOM: true,
      hand,
      team: 0 as Team,
      isReady: false,
      isHost: false,
      joinedAt: new Date(),
      isPasser: true, // Auto-pass placeholder COM players so blow phase can continue
      hasBroken: false,
    } as RoomPlayer;
  }

  private createActiveCOMReplacement(
    index: number | string,
    sourcePlayer: Pick<
      DomainPlayer | RoomPlayer,
      'team' | 'isPasser' | 'hasBroken' | 'hasRequiredBroken'
    >,
    hand: string[] = [],
  ): RoomPlayer {
    const comPlayer = this.createCOMPlaceholder(index, hand);
    comPlayer.team = sourcePlayer.team;
    comPlayer.isPasser = sourcePlayer.isPasser;
    comPlayer.hasBroken = sourcePlayer.hasBroken ?? false;
    comPlayer.hasRequiredBroken = sourcePlayer.hasRequiredBroken ?? false;
    return comPlayer;
  }

  async initCOMPlaceholders(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;
    const gameState = await this.getRoomGameState(roomId);
    await this.comSessionService.initCOMPlaceholders(roomId, room, gameState);
  }

  private cloneRoomPlayer(player: RoomPlayer): RoomPlayer {
    return {
      ...player,
      socketId: '',
      hand: [...player.hand],
      joinedAt: new Date(player.joinedAt),
    };
  }

  private cloneGamePlayer(player: DomainPlayer): DomainPlayer {
    return toDomainPlayer(player);
  }

  private remapPlayStatePlayerIdReferences(
    state: GameState,
    fromPlayerId: string,
    toPlayerId: string,
  ): void {
    const playState = state.playState;
    if (!playState || fromPlayerId === toPlayerId) {
      return;
    }

    if (playState.currentField?.dealerId === fromPlayerId) {
      playState.currentField.dealerId = toPlayerId;
    }

    if (playState.lastWinnerId === fromPlayerId) {
      playState.lastWinnerId = toPlayerId;
    }

    if (playState.openDeclarerId === fromPlayerId) {
      playState.openDeclarerId = toPlayerId;
    }

    playState.fields = playState.fields.map((field) => ({
      ...field,
      winnerId: field.winnerId === fromPlayerId ? toPlayerId : field.winnerId,
      dealerId: field.dealerId === fromPlayerId ? toPlayerId : field.dealerId,
    }));

    if (playState.neguri[fromPlayerId]) {
      playState.neguri[toPlayerId] = playState.neguri[fromPlayerId];
      delete playState.neguri[fromPlayerId];
    }
  }

  private remapBlowStatePlayerIdReferences(
    state: GameState,
    fromPlayerId: string,
    toPlayerId: string,
  ): void {
    const blowState = state.blowState;
    if (!blowState || fromPlayerId === toPlayerId) {
      return;
    }

    blowState.declarations = blowState.declarations.map((declaration) =>
      declaration.playerId === fromPlayerId
        ? { ...declaration, playerId: toPlayerId }
        : declaration,
    );

    blowState.actionHistory = blowState.actionHistory.map((action) =>
      action.playerId === fromPlayerId
        ? { ...action, playerId: toPlayerId }
        : action,
    );

    if (blowState.currentHighestDeclaration?.playerId === fromPlayerId) {
      blowState.currentHighestDeclaration = {
        ...blowState.currentHighestDeclaration,
        playerId: toPlayerId,
      };
    }

    if (blowState.lastPasser === fromPlayerId) {
      blowState.lastPasser = toPlayerId;
    }
  }

  private remapGameStatePlayerIdReferences(
    state: GameState,
    fromPlayerId: string,
    toPlayerId: string,
  ): void {
    this.playerReferenceRemapperService.remapGameStatePlayerIdReferences(
      state,
      fromPlayerId,
      toPlayerId,
    );
  }

  async fillVacantSeatsWithCOM(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;

    const gameState = this.roomGameStates.get(roomId);
    await this.comSessionService.fillVacantSeatsWithCOM(
      roomId,
      room,
      gameState,
    );
  }

  /**
   * プレイヤーをCOMに変換（タイムアウト時など）
   * reconnectTokenは保持したまま、席をvacantにする
   */
  async convertPlayerToCOM(roomId: string, playerId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;
    const gameState = this.roomGameStates.get(roomId);
    return this.comSessionService.convertPlayerToCOM(
      roomId,
      playerId,
      room,
      gameState,
      this.vacantSeats,
    );
  }

  async leaveRoom(roomId: string, playerId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    // getRoomGameState を使うことで、サーバー再起動/ホットリロード後でも
    // DBからゲーム状態を復元してleaveを継続できるようにする
    const gameState = await this.getRoomGameState(roomId);

    // ゲーム中かどうかで分岐:
    // room.status が正しく PLAYING に更新されていない場合（WAITING→PLAYING遷移が
    // RoomStatus の状態機械では READY を経由する必要があり、直接遷移できないケース）でも
    // インメモリの gameStarted フラグを見ることでゲーム中を正しく判定できる
    const isGameStarted =
      room.status === RoomStatus.PLAYING ||
      gameState.getState().gamePhase !== null;

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

        const gsIndex = state.players.findIndex((p) => p.playerId === playerId);

        // プレイヤーをCOMに置き換え（手札を引き継いでCOMが続行できるようにする）
        // タイムスタンプ付きIDで既存COMとのID衝突を防ぐ
        const uniqueIdx = `left-${Date.now()}`;
        const originalHand = room.players[playerIndex].hand ?? [];
        const comPlayer = this.createActiveCOMReplacement(
          uniqueIdx,
          room.players[playerIndex],
          [...originalHand],
        );

        this.vacantSeats[roomId][playerIndex] = {
          roomPlayer: this.cloneRoomPlayer(room.players[playerIndex]),
          gamePlayer:
            gsIndex !== -1
              ? this.cloneGamePlayer(state.players[gsIndex])
              : undefined,
          replacementPlayerId: comPlayer.playerId,
        };

        room.players[playerIndex] = comPlayer;

        // データベースでは元のプレイヤーを削除してCOMプレイヤーを追加
        await this.roomRepository.removePlayer(roomId, playerId);
        await this.roomRepository.addPlayer(roomId, comPlayer);

        // ゲーム状態も同時に更新（手札を引き継ぐ）
        if (gsIndex !== -1) {
          const originalGameHand = state.players[gsIndex].hand ?? [];
          const comGamePlayer = this.createActiveCOMReplacement(
            uniqueIdx,
            state.players[gsIndex],
            [...originalGameHand],
          );
          state.players[gsIndex] = toDomainPlayer(comGamePlayer);
          this.remapGameStatePlayerIdReferences(
            state,
            playerId,
            comGamePlayer.playerId,
          );
          if (state.teamAssignments[playerId] != null) {
            delete state.teamAssignments[playerId];
          }
          state.teamAssignments[comGamePlayer.playerId] = comGamePlayer.team;
        }

        // 再接続トークンは保持（同じplayerIdで再join可能にする）
        // 他のプレイヤーがこの席を取ったら、その時点でトークンを削除
        // gameState.removePlayerToken(playerId);  // ← 削除しない
      }
    } else {
      // ロビー状態: 退室プレイヤーをCOMに置き換え（空席を常時COMで維持）
      const playerIndex = room.players.findIndex(
        (p) => p.playerId === playerId,
      );
      if (playerIndex !== -1) {
        const comPlaceholder = this.createCOMPlaceholder(playerIndex);
        room.players[playerIndex] = comPlaceholder;
        await this.roomRepository.removePlayer(roomId, playerId);
        await this.roomRepository.addPlayer(roomId, comPlaceholder);

        const state = gameState.getState();
        const gsIndex = state.players.findIndex((p) => p.playerId === playerId);
        if (gsIndex !== -1) {
          state.players[gsIndex] = toDomainPlayer(
            this.createCOMPlaceholder(gsIndex),
          );
        }
      }
      // 再接続トークンを削除
      gameState.removePlayerToken(playerId);
    }

    // ゲーム状態をDBに保存（COMプレイヤーへの置き換えを永続化）
    await gameState.saveState();

    // If all players are COM placeholders (no human players), delete the room
    if (room.players.every((p) => p.isCOM === true)) {
      await this.deleteRoom(roomId);
      return true;
    }

    // If host left, assign new host
    if (room.hostId === playerId) {
      const newHost = room.players.find((p) => !p.isCOM);
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

  async joinRoom(roomId: string, user: SessionUser): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }
    const gameState = await this.getRoomGameState(roomId);
    return this.roomJoinService.joinRoom({
      roomId,
      room,
      gameState,
      user,
      vacantSeats: this.vacantSeats,
    });
  }

  async restorePlayerFromVacantSeat(
    roomId: string,
    playerId: string,
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }
    const gameState = await this.getRoomGameState(roomId);
    const restored =
      await this.seatRestorationService.restorePlayerFromVacantSeat(
        roomId,
        playerId,
        room,
        gameState,
        this.vacantSeats,
      );
    if (restored) {
      await this.updateRoomActivity(roomId);
    }
    return restored;
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
      [RoomStatus.WAITING]: [
        RoomStatus.READY,
        RoomStatus.PLAYING,
        RoomStatus.ABANDONED,
      ],
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

    // 実際のプレイヤー（COMを除く）が1人以上いるか確認
    const actualPlayers = room.players.filter((p) => !p.isCOM);
    if (actualPlayers.length === 0) {
      return { canStart: false, reason: 'Need at least 1 player to start' };
    }

    // 空席がある場合（COMプレースホルダーまたは実プレイヤー不足）: ホストがすぐ開始できる（残席にCOMが入る）
    const hasCOMPlaceholders = room.players.some(
      (p) => p.isCOM === true && !p.isReady,
    );
    const hasVacantSeats = actualPlayers.length < room.settings.maxPlayers;

    if (hasCOMPlaceholders || hasVacantSeats) {
      return { canStart: true };
    }

    // 全員人間で満席の場合も、現在の待機UIでは ready 操作を出していないため
    // ホストがそのまま開始できるようにする。
    return { canStart: true };
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
    userId?: string,
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

    this.logger.log(
      `[RoomService] Player reconnection playerId=${playerId} userId=${userId ?? 'guest'} hadUserId=${String(!!roomGameState.findSessionUserByPlayerId(playerId)?.userId)}`,
    );

    const connectionState: PlayerConnectionState = {
      socketId,
    };
    if (userId) {
      connectionState.userId = userId;
      connectionState.isAuthenticated = true;
    }

    await roomGameState.applyPlayerConnectionState(playerId, connectionState);

    const roomPlayerUpdates: {
      socketId: string;
      userId?: string;
      isAuthenticated?: boolean;
    } = {
      socketId,
    };
    if (connectionState.userId !== undefined) {
      roomPlayerUpdates.userId = connectionState.userId;
    }
    if (connectionState.isAuthenticated !== undefined) {
      roomPlayerUpdates.isAuthenticated = connectionState.isAuthenticated;
    }

    await this.roomRepository.updatePlayer(roomId, playerId, roomPlayerUpdates);

    return { success: true };
  }

  async updateUserGameStats(
    userId: string,
    won: boolean,
    score: number,
  ): Promise<void> {
    await this.userGameStatsService.updateUserGameStats(userId, won, score);
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    await this.userGameStatsService.updateUserLastSeen(userId);
  }
}
