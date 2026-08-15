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
import { DomainPlayer, Team } from '../types/game.types';
import { toDomainPlayer, toRoomPlayer } from '../adapters/player-adapters';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { IRoomService } from './interfaces/room-service.interface';
import { IComPlayerService } from './interfaces/com-player-service.interface';
import { UserGameStatsService } from './user-game-stats.service';
import { ComSessionService } from './com-session.service';
import { SeatRestorationService } from './seat-restoration.service';
import { RoomJoinService } from './room-join.service';
import { PlayerConnectionState, SessionUser } from '../types/session.types';
import { RoomMembershipService } from './room-membership.service';
import {
  ActiveRoomMembershipConflictError,
  RosterMembershipMutation,
} from '../types/room-membership.types';
import { randomUUID } from 'crypto';
import { asSeatId } from '../types/identity.types';
import { upsertRuntimeSeat } from './runtime-seat-roster';
import type { VacantSeats } from '../types/vacant-seat.types';
import type { SeatId } from '../types/identity.types';

@Injectable()
export class RoomService implements IRoomService, OnModuleDestroy {
  private readonly logger = new Logger(RoomService.name);
  private roomGameStates: Map<string, GameStateService> = new Map();
  // 退出席情報（ルームIDごとに不変の席UUIDをキーとして保存）
  private vacantSeats: VacantSeats = {};

  private readonly ROOM_EXPIRY_TIME = 6 * 60 * 60 * 1000; // 6時間
  private readonly FINISHED_ROOM_RETENTION_TIME = 30 * 24 * 60 * 60 * 1000; // 30日
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分
  private cleanupIntervalId: ReturnType<typeof setInterval>;
  private readonly userGameStatsService: UserGameStatsService;
  private readonly comSessionService: ComSessionService;
  private readonly seatRestorationService: SeatRestorationService;
  private readonly roomJoinService: RoomJoinService;

  private normalizeRoomHostFlags(room: Room): Room {
    return {
      ...room,
      players: room.players.map((player) => ({
        ...player,
        isHost: player.seatId === room.hostSeatId,
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
    private readonly roomMembershipService: RoomMembershipService,
    @Optional()
    userGameStatsService?: UserGameStatsService,
    @Optional()
    comSessionService?: ComSessionService,
    @Optional()
    seatRestorationService?: SeatRestorationService,
    @Optional()
    roomJoinService?: RoomJoinService,
  ) {
    this.userGameStatsService =
      userGameStatsService ??
      new UserGameStatsService(this.userProfileRepository);
    this.comSessionService =
      comSessionService ?? new ComSessionService(this.comPlayerService);
    this.seatRestorationService =
      seatRestorationService ?? new SeatRestorationService();
    this.roomJoinService = roomJoinService ?? new RoomJoinService();
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
      const rooms = await this.roomRepository.findAll();

      for (const room of rooms) {
        const roomAge = now.getTime() - room.lastActivityAt.getTime();
        const shouldDeleteFinishedRoom =
          room.status === RoomStatus.FINISHED &&
          roomAge > this.FINISHED_ROOM_RETENTION_TIME;
        const shouldDeleteInactiveRoom =
          room.status !== RoomStatus.FINISHED &&
          roomAge > this.ROOM_EXPIRY_TIME;

        if (shouldDeleteFinishedRoom || shouldDeleteInactiveRoom) {
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
    try {
      await this.roomMembershipService.releaseRoom(roomId);
    } catch (error) {
      this.logger.error(
        `Failed to release memberships before deleting room ${roomId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    await this.roomRepository.delete(roomId);
    await this.releaseRoomResources(roomId);
  }

  releaseRoomResources(roomId: string): Promise<void> {
    this.roomGameStates.delete(roomId);
    delete this.vacantSeats[roomId];
    return Promise.resolve();
  }

  async listRooms(): Promise<Room[]> {
    const rooms = await this.roomRepository.findAll();
    return rooms
      .map((room) => this.normalizeRoomHostFlags(room))
      .filter(
        (room) =>
          room.status !== RoomStatus.FINISHED &&
          room.status !== RoomStatus.ABANDONED,
      )
      .filter((room) => room.players.some((player) => !player.isCOM));
  }

  async createNewRoom(
    name: string,
    hostUser: SessionUser,
    pointsToWin: number,
    teamAssignmentMethod: 'random' | 'host-choice',
  ): Promise<Room> {
    if (!hostUser.userId) {
      throw new Error('Authenticated host user is required');
    }

    const hostUserId = hostUser.userId;
    const hostSeatId = asSeatId(randomUUID());
    const canonicalHostUser: SessionUser = {
      ...hostUser,
      seatId: hostSeatId,
    };
    const reservation = await this.roomMembershipService.reserve(
      hostUserId,
      hostSeatId,
    );
    if (reservation.result === 'conflict') {
      throw new ActiveRoomMembershipConflictError(reservation.membership);
    }

    const room: Room = {
      id: randomUUID(),
      name,
      hostSeatId,
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

    const hostPlayer = toRoomPlayer({
      session: canonicalHostUser,
      participantKey: hostUserId,
      gameplay: {
        seatId: hostSeatId,
        name: hostUser.name,
        hand: [],
        team: 0,
        isPasser: false,
        isCOM: false,
        hasBroken: false,
        hasRequiredBroken: false,
      },
      isReady: false,
      isHost: true,
      joinedAt: new Date(),
    });
    hostPlayer.seatIndex = 0;
    room.players = [hostPlayer];

    try {
      const createdRoom = await this.roomRepository.createWithHostSeat(
        room,
        hostPlayer,
        reservation.membership.transitionId,
      );
      const gameState = this.gameStateFactory.createGameState();
      gameState.setRoomId(createdRoom.id);
      await gameState.loadState(createdRoom.id);
      this.roomGameStates.set(createdRoom.id, gameState);
      return createdRoom;
    } catch (error) {
      try {
        await this.roomMembershipService.cancelReservation(
          hostUserId,
          reservation.membership.transitionId,
        );
      } catch (reservationError) {
        this.logger.error(
          `Failed to cancel room creation reservation for user ${hostUserId}`,
          reservationError instanceof Error
            ? reservationError.stack
            : String(reservationError),
        );
      }
      throw error;
    }
  }

  cancelRoomMembershipReservation(userId: string): Promise<boolean> {
    return this.roomMembershipService.cancelReservation(userId);
  }

  private createCOMPlaceholder(
    index: number | string,
    team: Team,
    hand: string[] = [],
    seatId = asSeatId(randomUUID()),
  ): RoomPlayer {
    const idStr = String(index);
    return {
      socketId: `com-${idStr}`,
      seatId,
      participantKey: `com-${idStr}-${seatId}`,
      name: 'COM',
      isCOM: true,
      hand,
      team,
      isReady: false,
      isHost: false,
      joinedAt: new Date(),
      isPasser: true, // Auto-pass placeholder COM players so blow phase can continue
      hasBroken: false,
    } as RoomPlayer;
  }

  private createActiveCOMReplacement(
    index: number | string,
    sourcePlayer: Pick<RoomPlayer, 'seatId' | 'team'>,
  ): RoomPlayer {
    return this.createCOMPlaceholder(
      index,
      sourcePlayer.team,
      [],
      sourcePlayer.seatId,
    );
  }

  private createWaitingCOMReplacement(
    preferredIndex: number,
    fallbackIndex: number,
    team: Team,
    roomPlayers: RoomPlayer[],
    statePlayers: DomainPlayer[],
    replacingRoomIndex: number,
    replacingStateIndex: number,
  ): RoomPlayer {
    const sourcePlayer =
      roomPlayers[replacingRoomIndex] ?? statePlayers[replacingStateIndex];
    return this.createCOMPlaceholder(
      preferredIndex ?? fallbackIndex,
      team,
      [],
      sourcePlayer.seatId,
    );
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
      joinedAt: new Date(player.joinedAt),
    };
  }

  private cloneGamePlayer(player: DomainPlayer): DomainPlayer {
    return toDomainPlayer(player);
  }

  async fillVacantSeatsWithCOM(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;

    const gameState = await this.getRoomGameState(roomId);
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
  async convertPlayerToCOM(
    roomId: string,
    seatId: SeatId,
    options?: {
      requireDisconnected?: boolean;
      releaseMembership?: boolean;
      membershipMutation?: RosterMembershipMutation;
    },
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;
    const gameState = await this.getRoomGameState(roomId);
    if (
      options?.requireDisconnected &&
      gameState.getPlayerConnectionState(seatId)?.socketId
    ) {
      return false;
    }

    const membershipMutation =
      options?.membershipMutation ??
      (options?.releaseMembership !== false
        ? this.buildMembershipRelease(seatId)
        : undefined);
    return this.comSessionService.convertPlayerToCOM(
      roomId,
      seatId,
      room,
      gameState,
      this.vacantSeats,
      membershipMutation,
    );
  }

  async leaveRoom(
    roomId: string,
    seatId: SeatId,
    options?: {
      releaseMembership?: boolean;
      membershipMutation?: RosterMembershipMutation;
    },
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    // getRoomGameState を使うことで、サーバー再起動/ホットリロード後でも
    // DBからゲーム状態を復元してleaveを継続できるようにする
    const gameState = await this.getRoomGameState(roomId);
    const membershipMutation =
      options?.membershipMutation ??
      (options?.releaseMembership !== false
        ? this.buildMembershipRelease(seatId)
        : undefined);

    // ゲーム中かどうかで分岐:
    // room.status が正しく PLAYING に更新されていない場合（WAITING→PLAYING遷移が
    // RoomStatus の状態機械では READY を経由する必要があり、直接遷移できないケース）でも
    // インメモリの gameStarted フラグを見ることでゲーム中を正しく判定できる
    const isGameStarted =
      room.status === RoomStatus.PLAYING ||
      gameState.getState().gamePhase !== null;

    if (isGameStarted) {
      const state = gameState.getState();

      // 退出したプレイヤーのindexを記録
      const playerIndex = room.players.findIndex((p) => p.seatId === seatId);
      if (playerIndex !== -1) {
        if (!this.vacantSeats[roomId]) this.vacantSeats[roomId] = {};

        const gsIndex = state.players.findIndex((p) => p.seatId === seatId);

        // 席UUIDを維持したまま占有者をCOMへ切り替える。
        // uniqueIdxはsocket/participant metadataだけを識別する。
        const uniqueIdx = `left-${Date.now()}`;
        const comPlayer = this.createActiveCOMReplacement(
          uniqueIdx,
          room.players[playerIndex],
        );

        const resolvedSeatId = room.players[playerIndex].seatId;
        this.vacantSeats[roomId][resolvedSeatId] = {
          roomPlayer: this.cloneRoomPlayer(room.players[playerIndex]),
          gamePlayer:
            gsIndex !== -1
              ? this.cloneGamePlayer(state.players[gsIndex])
              : undefined,
        };

        upsertRuntimeSeat(room, state, comPlayer, {
          replaceSeatId: seatId,
          gameplaySource: gsIndex === -1 ? null : state.players[gsIndex],
        });

        // 元の占有者が同じseatIdへ戻れるよう再接続トークンは保持する。
        // 他のプレイヤーがこの席を取ったら、その時点でトークンを削除
        // Keep the seat token so the original occupant can reconnect.
      }
    } else {
      // ロビー状態: 退室プレイヤーをCOMに置き換え（空席を常時COMで維持）
      const playerIndex = room.players.findIndex((p) => p.seatId === seatId);
      if (playerIndex !== -1) {
        const leavingPlayer = room.players[playerIndex];
        const state = gameState.getState();
        const gsIndex = state.players.findIndex((p) => p.seatId === seatId);
        const seatIndex = gsIndex !== -1 ? gsIndex : playerIndex;
        const comPlaceholder = this.createWaitingCOMReplacement(
          seatIndex,
          playerIndex,
          leavingPlayer.team,
          room.players,
          state.players,
          playerIndex,
          gsIndex,
        );
        upsertRuntimeSeat(room, state, comPlaceholder, {
          replaceSeatId: seatId,
          gameplaySource: gsIndex === -1 ? null : state.players[gsIndex],
        });
      }
      // 再接続トークンを削除
      gameState.removeSeatToken(seatId);
    }

    // If all players are COM placeholders (no human players), delete the room
    if (room.players.every((p) => p.isCOM === true)) {
      await this.deleteRoom(roomId);
      return true;
    }

    // If host left, assign new host
    if (room.hostSeatId === seatId) {
      const newHost = room.players.find((p) => !p.isCOM);
      if (newHost) {
        room.hostSeatId = asSeatId(newHost.seatId);
      }
    }

    room.players.forEach((player) => {
      player.isHost = player.seatId === room.hostSeatId;
    });
    await gameState.persistRoster(
      room.players,
      room.hostSeatId,
      membershipMutation,
    );
    return true;
  }

  async joinRoom(roomId: string, user: SessionUser): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }
    const joiningUser = await this.resolveJoiningUser(roomId, room, user);
    if (joiningUser.userId) {
      const membership = await this.roomMembershipService.get(
        joiningUser.userId,
      );
      if (membership && membership.roomId !== roomId) {
        throw new ActiveRoomMembershipConflictError(membership);
      }
    }

    const gameState = await this.getRoomGameState(roomId);
    const vacantSeatSnapshot = this.cloneVacantSeatsForRoom(roomId);
    try {
      const joined = await this.roomJoinService.joinRoom({
        roomId,
        room,
        gameState,
        user: joiningUser,
        vacantSeats: this.vacantSeats,
      });
      if (!joined) {
        await this.rollbackJoinRoomState(roomId, vacantSeatSnapshot);
      }
      return joined;
    } catch (error) {
      this.logger.error(
        `Failed to join room ${roomId}; reloading in-memory state from persistence`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.rollbackJoinRoomState(roomId, vacantSeatSnapshot);
      return false;
    }
  }

  private cloneVacantSeatsForRoom(roomId: string): VacantSeats[string] | null {
    const roomVacantSeats = this.vacantSeats[roomId];
    if (!roomVacantSeats) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(roomVacantSeats).map(([seatId, seatData]) => [
        seatId,
        {
          roomPlayer: {
            ...seatData.roomPlayer,
            joinedAt: new Date(seatData.roomPlayer.joinedAt),
          },
          ...(seatData.gamePlayer && {
            gamePlayer: {
              ...seatData.gamePlayer,
              hand: [...seatData.gamePlayer.hand],
            },
          }),
        },
      ]),
    );
  }

  private async rollbackJoinRoomState(
    roomId: string,
    vacantSeatSnapshot: VacantSeats[string] | null,
  ): Promise<void> {
    if (vacantSeatSnapshot) {
      this.vacantSeats[roomId] = vacantSeatSnapshot;
    } else {
      delete this.vacantSeats[roomId];
    }

    this.roomGameStates.delete(roomId);
    const reloadedGameState = this.gameStateFactory.createGameState();
    reloadedGameState.setRoomId(roomId);
    await reloadedGameState.loadState(roomId);
    this.roomGameStates.set(roomId, reloadedGameState);
  }

  private async resolveJoiningUser(
    roomId: string,
    room: Room,
    user: SessionUser,
  ): Promise<SessionUser> {
    if (!user.userId) {
      return user;
    }

    const roomMatches = room.players.filter(
      (player) => player.userId === user.userId,
    );
    if (roomMatches.length === 1) {
      const seatId = asSeatId(roomMatches[0].seatId);
      return { ...user, seatId };
    }
    if (roomMatches.length > 1) {
      throw new Error(
        `Ambiguous room player identity: room=${roomId} user=${user.userId} matches=${roomMatches.length}`,
      );
    }

    const vacantMatches = Object.values(this.vacantSeats[roomId] ?? {}).filter(
      (seat) => seat.roomPlayer.userId === user.userId,
    );
    if (vacantMatches.length === 1) {
      const seatId = asSeatId(vacantMatches[0].roomPlayer.seatId);
      return {
        ...user,
        seatId,
      };
    }
    if (vacantMatches.length > 1) {
      throw new Error(
        `Ambiguous vacant seat identity: room=${roomId} user=${user.userId} matches=${vacantMatches.length}`,
      );
    }

    const membership = await this.roomMembershipService.get(user.userId);
    if (membership?.roomId === roomId) {
      const seatId = membership.seatId;
      return { ...user, seatId };
    }

    return user;
  }

  async restorePlayerFromVacantSeat(
    roomId: string,
    seatId: SeatId,
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }
    const gameState = await this.getRoomGameState(roomId);
    const restored =
      await this.seatRestorationService.restorePlayerFromVacantSeat(
        roomId,
        seatId,
        room,
        gameState,
        this.vacantSeats,
      );
    if (restored) {
      this.logger.log(`Restored seat ${seatId} in room ${roomId}`);
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
    if (
      updatedRoom &&
      (status === RoomStatus.FINISHED || status === RoomStatus.ABANDONED)
    ) {
      try {
        await this.roomMembershipService.releaseRoom(roomId);
      } catch (error) {
        this.logger.error(
          `Failed to release memberships for inactive room ${roomId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return !!updatedRoom;
  }

  private buildMembershipRelease(seatId: SeatId): RosterMembershipMutation {
    return {
      type: 'release',
      seatId,
      transitionId: randomUUID(),
    };
  }

  async updatePlayerInRoom(
    roomId: string,
    seatId: SeatId,
    updates: Partial<RoomPlayer>,
  ): Promise<boolean> {
    return this.updatePlayersInRoom(roomId, { [seatId]: updates });
  }

  async updatePlayersInRoom(
    roomId: string,
    updatesBySeatId: Partial<Record<SeatId, Partial<RoomPlayer>>>,
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    const gameState = await this.getRoomGameState(roomId);
    const state = gameState.getState();

    for (const [seatId, updates] of Object.entries(updatesBySeatId)) {
      if (!updates) {
        continue;
      }
      const roomPlayer = room.players.find(
        (player) => player.seatId === seatId,
      );
      if (!roomPlayer) {
        return false;
      }

      Object.assign(roomPlayer, updates);
      if (updates.isHost === true) {
        room.hostSeatId = asSeatId(seatId);
      }

      const statePlayerIndex = state.players.findIndex(
        (player) => player.seatId === seatId,
      );
      const statePlayer =
        statePlayerIndex === -1 ? null : state.players[statePlayerIndex];
      upsertRuntimeSeat(room, state, roomPlayer, {
        gameplaySource: statePlayer,
      });
    }

    room.players.forEach((player) => {
      player.isHost = player.seatId === room.hostSeatId;
    });
    await gameState.persistRoster(room.players, room.hostSeatId);
    return true;
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
      const room = await this.getRoom(roomId);
      if (!room) {
        throw new Error(`Room not found: ${roomId}`);
      }

      gameState = this.gameStateFactory.createGameState();
      gameState.setRoomId(roomId);
      await gameState.loadState(roomId);
      this.roomGameStates.set(roomId, gameState);
    }
    return gameState;
  }

  async handlePlayerReconnection(
    roomId: string,
    seatId: SeatId,
    socketId: string,
    userId?: string,
    name?: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Get room's game state first (has the most up-to-date player info)
    const roomGameState = await this.getRoomGameState(roomId);
    if (!roomGameState) {
      return { success: false, error: 'Game state not found' };
    }

    const state = roomGameState.getState();
    const player = state.players.find((p) => p.seatId === seatId);
    if (!player) {
      return { success: false, error: 'Player not found in room' };
    }

    const room = await this.getRoom(roomId);
    const roomPlayer = room?.players.find(
      (candidate) => candidate.seatId === seatId,
    );
    if (!roomPlayer) {
      return { success: false, error: 'Room player not found' };
    }
    const reclaimingTimedOutSeat = Boolean(
      roomPlayer.isCOM && userId && roomPlayer.userId === userId,
    );
    if (roomPlayer.isCOM && !reclaimingTimedOutSeat) {
      return { success: false, error: 'COM seat is not reclaimable' };
    }

    this.logger.log(
      `[RoomService] Seat reconnection seatId=${seatId} userId=${userId ?? 'guest'} hadUserId=${String(!!roomGameState.findSessionUserBySeatId(seatId)?.userId)}`,
    );

    const connectionState: PlayerConnectionState = {
      socketId,
    };
    if (userId) {
      connectionState.userId = userId;
      connectionState.isAuthenticated = true;
    }

    roomGameState.clearDisconnectTimeout(seatId);
    roomGameState.applyPlayerConnectionState(seatId, connectionState);

    const roomPlayerUpdates: {
      socketId: string;
      userId?: string;
      isAuthenticated?: boolean;
      name?: string;
      isCOM?: boolean;
      participantKey?: string;
    } = {
      socketId,
    };
    if (connectionState.userId !== undefined) {
      roomPlayerUpdates.userId = connectionState.userId;
    }
    if (connectionState.isAuthenticated !== undefined) {
      roomPlayerUpdates.isAuthenticated = connectionState.isAuthenticated;
    }
    if (name) {
      roomPlayerUpdates.name = name;
    }
    if (reclaimingTimedOutSeat) {
      roomPlayerUpdates.isCOM = false;
      roomPlayerUpdates.participantKey = userId;
    }

    const updated = await this.updatePlayerInRoom(
      roomId,
      seatId,
      roomPlayerUpdates,
    );
    if (!updated) {
      return { success: false, error: 'Failed to persist player connection' };
    }

    this.clearVacantSeatSnapshot(roomId, seatId);

    return { success: true };
  }

  private clearVacantSeatSnapshot(roomId: string, targetSeatId: SeatId): void {
    const roomVacantSeats = this.vacantSeats[roomId];
    if (!roomVacantSeats) {
      return;
    }

    for (const [seatId, seatData] of Object.entries(roomVacantSeats)) {
      if (
        seatId === targetSeatId ||
        seatData.roomPlayer.seatId === targetSeatId
      ) {
        delete roomVacantSeats[asSeatId(seatId)];
      }
    }

    if (Object.keys(roomVacantSeats).length === 0) {
      delete this.vacantSeats[roomId];
    }
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
