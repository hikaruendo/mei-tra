import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { Room, RoomPlayer } from '../types/room.types';
import { RoomStatus } from '../types/room.types';
import { GameStateService } from './game-state.service';
import { GameStateFactory } from './game-state.factory';
import { GameState, ConnectionUser, Team, Player } from '../types/game.types';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { IRoomService } from './interfaces/room-service.interface';
import { IComPlayerService } from './interfaces/com-player-service.interface';

@Injectable()
export class RoomService implements IRoomService, OnModuleDestroy {
  private readonly logger = new Logger(RoomService.name);
  private roomGameStates: Map<string, GameStateService> = new Map();
  // 退出席情報（ルームIDごとに席番号ベースで元プレイヤーのスナップショットを保存）
  private vacantSeats: Record<
    string,
    Record<
      number,
      {
        roomPlayer: RoomPlayer;
        gamePlayer?: Player;
        replacementPlayerId?: string;
      }
    >
  > = {};

  private readonly ROOM_EXPIRY_TIME = 6 * 60 * 60 * 1000; // 6時間
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分
  private cleanupIntervalId: ReturnType<typeof setInterval>;

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
  ) {
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
      Player,
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
    const state = gameState.getState();
    const CAPACITY = room.settings?.maxPlayers ?? 4;
    const actualCount = room.players.filter((p) => !p.isCOM).length;
    const placeholderCount = room.players.filter(
      (p) => p.isCOM && !p.isReady,
    ).length;
    const slotsToFill = CAPACITY - actualCount - placeholderCount;
    for (let i = 0; i < slotsToFill; i++) {
      const idx = actualCount + placeholderCount + i;
      // Balance teams: assign to whichever team has fewer players
      const team0Count = room.players.filter((p) => p.team === 0).length;
      const team1Count = room.players.filter((p) => p.team === 1).length;
      const team = (team0Count <= team1Count ? 0 : 1) as Team;
      const placeholder = this.createCOMPlaceholder(idx);
      placeholder.team = team;
      await this.roomRepository.addPlayer(roomId, placeholder);
      room.players.push(placeholder);
      state.players.push({
        ...placeholder,
        hand: [...placeholder.hand],
        isPasser: placeholder.isPasser ?? false,
        hasBroken: placeholder.hasBroken ?? false,
        hasRequiredBroken: placeholder.hasRequiredBroken ?? false,
      });
      state.teamAssignments[placeholder.playerId] = placeholder.team;
      gameState.registerPlayerToken(placeholder.playerId, placeholder.playerId);
    }
  }

  private cloneRoomPlayer(player: RoomPlayer): RoomPlayer {
    return {
      ...player,
      socketId: '',
      hand: [...player.hand],
      joinedAt: new Date(player.joinedAt),
    };
  }

  private cloneGamePlayer(player: Player): Player {
    return {
      ...player,
      socketId: '',
      hand: [...player.hand],
    };
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
    this.remapPlayStatePlayerIdReferences(state, fromPlayerId, toPlayerId);
    this.remapBlowStatePlayerIdReferences(state, fromPlayerId, toPlayerId);
  }

  private clearGameStateDisconnectTimeout(
    gameState: GameStateService,
    playerId: string,
  ): void {
    gameState.clearDisconnectTimeout(playerId);
  }

  async fillVacantSeatsWithCOM(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;

    const gameState = this.roomGameStates.get(roomId);

    // ロビーフェーズで作られた COM プレースホルダーを削除し、
    // 正しくチーム配分された COM ボットで置き換えることで 2:2 を保証する
    const lobbyComPlaceholders = room.players.filter((p) => p.isCOM === true);

    // Wait for all deletions to complete before proceeding
    const deletionPromises = lobbyComPlaceholders.map(
      async (comPlaceholder) => {
        await this.roomRepository.removePlayer(roomId, comPlaceholder.playerId);
        room.players = room.players.filter(
          (p) => p.playerId !== comPlaceholder.playerId,
        );
        if (gameState) {
          const state = gameState.getState();
          state.players = state.players.filter(
            (p) => p.playerId !== comPlaceholder.playerId,
          );
        }
      },
    );

    // Ensure all deletions complete before adding new players
    await Promise.all(deletionPromises);

    const maxPlayers = room.settings?.maxPlayers ?? 4;
    if (room.players.length >= maxPlayers) return;

    const comCount = maxPlayers - room.players.length;
    const existingTeam0Count = room.players.filter((p) => p.team === 0).length;
    const team0Needed = Math.max(0, 2 - existingTeam0Count);
    const startingPlayerCount = room.players.length; // Capture initial count

    for (let i = 0; i < comCount; i++) {
      // Fill team 0 first until it has 2 players, then fill team 1
      const team = i < team0Needed ? (0 as Team) : (1 as Team);
      const comPlayer = this.comPlayerService.createComPlayer(
        startingPlayerCount + i, // Use initial count, not current length
        team,
      ) as RoomPlayer;

      comPlayer.isReady = true;
      comPlayer.isHost = false;
      comPlayer.joinedAt = new Date();

      // Check return value of addPlayer
      const addResult = await this.roomRepository.addPlayer(roomId, comPlayer);

      if (!addResult) {
        this.logger.error(
          `Failed to add COM player ${comPlayer.playerId} to room ${roomId}`,
        );
        throw new Error(`Failed to add COM player ${comPlayer.playerId}`);
      }

      // Only add to memory if DB operation succeeded
      if (gameState) {
        const state = gameState.getState();
        state.players.push(comPlayer);
        gameState.registerPlayerToken(comPlayer.playerId, comPlayer.playerId);
      }

      // Update in-memory room
      room.players.push(comPlayer);
    }
  }

  /**
   * プレイヤーをCOMに変換（タイムアウト時など）
   * reconnectTokenは保持したまま、席をvacantにする
   */
  async convertPlayerToCOM(roomId: string, playerId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;

    const playerIndex = room.players.findIndex((p) => p.playerId === playerId);
    if (playerIndex === -1) return false;

    // hand/teamなどをvacantSeatsに保存
    if (!this.vacantSeats[roomId]) this.vacantSeats[roomId] = {};

    const gameState = this.roomGameStates.get(roomId);
    const state = gameState?.getState();
    const gsIndex = state
      ? state.players.findIndex((p) => p.playerId === playerId)
      : -1;

    // COMプレイヤーに置き換え（手札を引き継いでCOMが続行できるようにする）
    const originalHand = room.players[playerIndex].hand ?? [];
    const uniqueIdx = `timeout-${playerIndex}-${Date.now()}`;
    const comPlayer = this.createActiveCOMReplacement(
      uniqueIdx,
      room.players[playerIndex],
      [...originalHand],
    );

    this.vacantSeats[roomId][playerIndex] = {
      roomPlayer: this.cloneRoomPlayer(room.players[playerIndex]),
      gamePlayer:
        gsIndex !== -1 && state
          ? this.cloneGamePlayer(state.players[gsIndex])
          : undefined,
      replacementPlayerId: comPlayer.playerId,
    };

    room.players[playerIndex] = comPlayer;

    await this.roomRepository.removePlayer(roomId, playerId);
    await this.roomRepository.addPlayer(roomId, comPlayer);

    // ゲーム状態も更新（手札を引き継ぐ）
    if (gameState) {
      if (gsIndex !== -1 && state) {
        const originalGameHand = state.players[gsIndex].hand ?? [];
        const comGamePlayer = this.createActiveCOMReplacement(
          uniqueIdx,
          state.players[gsIndex],
          [...originalGameHand],
        );
        state.players[gsIndex] = comGamePlayer;
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
      // reconnectTokenは保持（removePlayerTokenを呼ばない）
    }

    return true;
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
          state.players[gsIndex] = comGamePlayer;
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
          state.players[gsIndex] = this.createCOMPlaceholder(gsIndex);
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

  async joinRoom(roomId: string, user: ConnectionUser): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }
    const gameState = await this.getRoomGameState(roomId);
    const state = gameState.getState();

    // Check if room is full (excluding COM players)
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
    let gsAssignedIndex = -1; // ゲームステート内のインデックス（DBと順序が異なる場合がある）
    let hand: string[] = [];
    let team: Team = 0 as Team;
    let replacingComId: string | null = null;
    let restoredSeatData: {
      roomPlayer: RoomPlayer;
      gamePlayer?: Player;
      replacementPlayerId?: string;
    } | null = null;

    // まず、user.playerIdと一致するvacantSeatがあるかチェック（同じプレイヤーの復帰）
    const matchingVacantIndex = vacantIndexes.find(
      (idx) => roomVacant[idx]?.roomPlayer.playerId === user.playerId,
    );

    if (matchingVacantIndex !== undefined) {
      // 同じplayerIdで復帰 → 元の席・hand・teamを復元
      assignedIndex = matchingVacantIndex;
      const seatData = roomVacant[assignedIndex];
      const seatRoomPlayer = seatData?.roomPlayer;
      const seatGamePlayer = seatData?.gamePlayer;

      hand = seatGamePlayer
        ? [...seatGamePlayer.hand]
        : seatRoomPlayer
          ? [...seatRoomPlayer.hand]
          : [];
      team = seatRoomPlayer ? seatRoomPlayer.team : team;
      restoredSeatData = seatData ?? null;
      this.clearGameStateDisconnectTimeout(gameState, user.playerId);
      delete roomVacant[assignedIndex];
      if (Object.keys(roomVacant).length === 0) delete this.vacantSeats[roomId];
    } else if (vacantIndexes.length > 0) {
      // 別のplayerIdで新規参加 → 最初のvacant seatを使用
      assignedIndex = vacantIndexes[0];
      const seatData = roomVacant[assignedIndex];
      const seatRoomPlayer = seatData?.roomPlayer;
      hand = seatRoomPlayer ? [...seatRoomPlayer.hand] : [];
      team = seatRoomPlayer ? seatRoomPlayer.team : team;
      // 元のplayerIdのトークンを削除（別の人が席を取った）
      const originalPlayerId = seatRoomPlayer?.playerId;
      if (originalPlayerId) {
        gameState.removePlayerToken(originalPlayerId);
        this.clearGameStateDisconnectTimeout(gameState, originalPlayerId);
      }
      restoredSeatData = seatData ?? null;
      delete roomVacant[assignedIndex];
      if (Object.keys(roomVacant).length === 0) delete this.vacantSeats[roomId];
    } else {
      // ゲーム中（gamePhase !== null）かつ vacantSeats なし → COMの手札・チームを引き継ぐ
      if (state.gamePhase !== null) {
        const comIdx = room.players.findIndex((p) => p.isCOM === true);
        if (comIdx !== -1) {
          const comPlayerId = room.players[comIdx].playerId;
          team = room.players[comIdx].team;
          replacingComId = comPlayerId;
          assignedIndex = comIdx; // DB room.players のインデックス

          // ゲームステートのインデックスは playerId で検索（DB とメモリで順序が異なる場合がある）
          gsAssignedIndex = state.players.findIndex(
            (p) => p.playerId === comPlayerId,
          );
          const gsPlayer =
            gsAssignedIndex !== -1 ? state.players[gsAssignedIndex] : null;
          hand = gsPlayer
            ? [...(gsPlayer.hand ?? [])]
            : [...(room.players[comIdx].hand ?? [])];
        }
      }

      // 手札が空のまま（ロビー or COMなし）→ チーム自動割り当て
      if (hand.length === 0) {
        const team0Count = room.players.filter(
          (p) => !p.isCOM && p.team === 0,
        ).length;
        const team1Count = room.players.filter(
          (p) => !p.isCOM && p.team === 1,
        ).length;
        team = (team0Count <= team1Count ? 0 : 1) as Team;
      }

      // 待機中ルームでvacantSeatsなし → COMプレースホルダーを置換する
      // (DBとin-memoryを一致させるためreplacingComIdとassignedIndexをここで設定)
      if (!replacingComId && assignedIndex === -1) {
        const waitingCOMIndex = room.players.findIndex(
          (p) => p.isCOM === true && !p.isReady,
        );
        if (waitingCOMIndex !== -1) {
          replacingComId = room.players[waitingCOMIndex].playerId;
          assignedIndex = waitingCOMIndex;
        }
      }
    }

    const seatRoomSnapshot = restoredSeatData?.roomPlayer;
    const seatGameSnapshot = restoredSeatData?.gamePlayer;
    const replacementPlayerId = restoredSeatData?.replacementPlayerId;

    if (replacementPlayerId) {
      const currentRoomSeatIndex = room.players.findIndex(
        (p) => p.playerId === replacementPlayerId,
      );
      if (currentRoomSeatIndex !== -1) {
        assignedIndex = currentRoomSeatIndex;
        replacingComId = replacementPlayerId;
      }
    } else if (assignedIndex !== -1) {
      replacingComId = room.players[assignedIndex]?.playerId || null;
    }

    const currentSeatRoomPlayer =
      replacingComId != null
        ? room.players.find((p) => p.playerId === replacingComId)
        : assignedIndex !== -1
          ? room.players[assignedIndex]
          : undefined;
    const currentSeatRoomHand =
      currentSeatRoomPlayer && currentSeatRoomPlayer.hand.length > 0
        ? currentSeatRoomPlayer.hand
        : undefined;

    const player: RoomPlayer = {
      ...(seatRoomSnapshot ?? {}),
      ...user,
      socketId: user.socketId,
      playerId: user.playerId,
      team: currentSeatRoomPlayer?.team ?? team,
      hand: [...(currentSeatRoomHand ?? hand)],
      isPasser:
        seatGameSnapshot?.isPasser ??
        currentSeatRoomPlayer?.isPasser ??
        seatRoomSnapshot?.isPasser ??
        false,
      hasBroken:
        seatGameSnapshot?.hasBroken ??
        currentSeatRoomPlayer?.hasBroken ??
        seatRoomSnapshot?.hasBroken ??
        false,
      hasRequiredBroken:
        seatGameSnapshot?.hasRequiredBroken ??
        currentSeatRoomPlayer?.hasRequiredBroken ??
        seatRoomSnapshot?.hasRequiredBroken ??
        false,
      isReady:
        currentSeatRoomPlayer?.isReady ?? seatRoomSnapshot?.isReady ?? false,
      isHost: room.hostId === user.playerId,
      joinedAt: seatRoomSnapshot?.joinedAt
        ? new Date(seatRoomSnapshot.joinedAt)
        : new Date(),
    };

    // データベース操作
    if (replacingComId) {
      // COMプレイヤーを削除して新しいプレイヤーを追加
      await this.roomRepository.removePlayer(roomId, replacingComId);
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
      // COMプレイヤーの席を探す
      const comIndex = room.players.findIndex(
        (p) => p.isCOM === true && !p.isReady,
      );
      if (comIndex !== -1) {
        room.players[comIndex] = player;
      } else {
        room.players.push(player);
      }
    }

    // Update game state if it exists
    if (replacementPlayerId) {
      gsAssignedIndex = state.players.findIndex(
        (p) => p.playerId === replacementPlayerId,
      );
    }
    if (gsAssignedIndex === -1 && replacingComId) {
      gsAssignedIndex = state.players.findIndex(
        (p) => p.playerId === replacingComId,
      );
    }
    const currentSeatGamePlayer =
      replacingComId != null
        ? state.players.find((p) => p.playerId === replacingComId)
        : undefined;
    player.hand = [
      ...(currentSeatGamePlayer?.hand.length
        ? currentSeatGamePlayer.hand
        : player.hand),
    ];
    player.isPasser =
      currentSeatGamePlayer?.isPasser ?? player.isPasser ?? false;
    player.hasBroken =
      currentSeatGamePlayer?.hasBroken ?? player.hasBroken ?? false;
    player.hasRequiredBroken =
      currentSeatGamePlayer?.hasRequiredBroken ??
      player.hasRequiredBroken ??
      false;
    if (gsAssignedIndex !== -1) {
      state.players[gsAssignedIndex] = player;
    } else {
      const comIndex = state.players.findIndex((p) => p.isCOM === true);
      if (comIndex !== -1) {
        state.players[comIndex] = player;
      } else {
        state.players.push(player);
      }
    }

    if (replacingComId) {
      this.remapGameStatePlayerIdReferences(
        state,
        replacingComId,
        player.playerId,
      );
      if (state.teamAssignments[replacingComId] != null) {
        delete state.teamAssignments[replacingComId];
      }
    }
    state.teamAssignments[player.playerId] = player.team;

    // Register player token for reconnection
    // Use playerId as both token and playerId for consistency
    gameState.registerPlayerToken(player.playerId, player.playerId);

    // アクティビティ時刻のみ更新（プレイヤー情報の再取得を避ける）
    await this.updateRoomActivity(roomId);
    return true;
  }

  async restorePlayerFromVacantSeat(
    roomId: string,
    playerId: string,
  ): Promise<boolean> {
    const vacantSeatsForRoom = this.vacantSeats[roomId];
    if (!vacantSeatsForRoom) {
      return false;
    }

    const vacancyEntry = Object.entries(vacantSeatsForRoom).find(
      ([, data]) => data.roomPlayer.playerId === playerId,
    );

    if (!vacancyEntry) {
      return false;
    }

    const [seatIndexKey, seatData] = vacancyEntry;
    const seatIndex = Number(seatIndexKey);

    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    const currentSeatPlayer =
      seatData.replacementPlayerId != null
        ? room.players.find((p) => p.playerId === seatData.replacementPlayerId)
        : room.players[seatIndex];
    if (!currentSeatPlayer || !currentSeatPlayer.isCOM) {
      return false;
    }
    const currentSeatIndex = room.players.findIndex(
      (p) => p.playerId === currentSeatPlayer.playerId,
    );
    if (currentSeatIndex === -1) {
      return false;
    }

    const comPlayerId = currentSeatPlayer.playerId;
    const restoredRoomPlayer: RoomPlayer = {
      ...seatData.roomPlayer,
      socketId: '',
      playerId,
      hand: [
        ...(currentSeatPlayer.hand.length
          ? currentSeatPlayer.hand
          : seatData.roomPlayer.hand),
      ],
      joinedAt: new Date(seatData.roomPlayer.joinedAt),
    };

    room.players[currentSeatIndex] = restoredRoomPlayer;

    await this.roomRepository.removePlayer(roomId, comPlayerId);
    const addSuccess = await this.roomRepository.addPlayer(
      roomId,
      restoredRoomPlayer,
    );

    if (!addSuccess) {
      // 追加に失敗した場合はCOMを戻しておく
      await this.roomRepository.addPlayer(roomId, currentSeatPlayer);
      room.players[currentSeatIndex] = currentSeatPlayer;
      return false;
    }

    const gameState = await this.getRoomGameState(roomId);
    const state = gameState.getState();
    const gsIndex = state.players.findIndex(
      (p) => p.playerId === comPlayerId || p.playerId === playerId,
    );

    const restoredGamePlayerBase: Player = seatData.gamePlayer
      ? {
          ...seatData.gamePlayer,
          socketId: '',
          playerId,
          hand: [
            ...(state.players[gsIndex]?.hand.length
              ? state.players[gsIndex].hand
              : seatData.gamePlayer.hand),
          ],
        }
      : {
          socketId: '',
          playerId,
          name: restoredRoomPlayer.name,
          team: restoredRoomPlayer.team,
          hand: [...restoredRoomPlayer.hand],
          isPasser: restoredRoomPlayer.isPasser,
          hasBroken: restoredRoomPlayer.hasBroken,
          hasRequiredBroken: restoredRoomPlayer.hasRequiredBroken,
        };

    if (gsIndex !== -1) {
      state.players[gsIndex] = {
        ...restoredGamePlayerBase,
        socketId: '',
        playerId,
        name: restoredRoomPlayer.name,
        team: restoredRoomPlayer.team,
        hand: [...restoredRoomPlayer.hand],
        isPasser:
          restoredGamePlayerBase.isPasser ??
          restoredRoomPlayer.isPasser ??
          false,
        hasBroken:
          restoredGamePlayerBase.hasBroken ??
          restoredRoomPlayer.hasBroken ??
          false,
        hasRequiredBroken:
          restoredGamePlayerBase.hasRequiredBroken ??
          restoredRoomPlayer.hasRequiredBroken ??
          false,
      };
    } else {
      state.players.push({
        ...restoredGamePlayerBase,
        socketId: '',
      });
    }

    this.remapGameStatePlayerIdReferences(state, comPlayerId, playerId);

    gameState.registerPlayerToken(playerId, playerId);
    gameState.clearDisconnectTimeout(playerId);
    if (state.teamAssignments[comPlayerId] != null) {
      delete state.teamAssignments[comPlayerId];
    }
    state.teamAssignments[playerId] = restoredRoomPlayer.team;

    delete vacantSeatsForRoom[seatIndex];
    if (Object.keys(vacantSeatsForRoom).length === 0) {
      delete this.vacantSeats[roomId];
    }

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

  private countActualPlayers(players: RoomPlayer[]): number {
    return players.filter((p) => !p.isCOM).length;
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

    // Log reconnection details
    console.log(`[RoomService] Player reconnection:`, {
      playerId,
      socketId,
      userId: userId || 'none (guest)',
      hadUserId: !!player.userId,
    });

    // Update player's socket ID and userId in game state
    void roomGameState.updatePlayerSocketId(playerId, socketId, userId);

    // Update player's socket ID and userId in database directly
    const updates: { socketId: string; userId?: string } = { socketId };
    if (userId) {
      updates.userId = userId;
    }
    await this.roomRepository.updatePlayer(roomId, playerId, updates);

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
