import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import type {
  PlayCardPayload,
  RequestAgariPayload,
  RevealAgariPayload,
  SyncGameStatePayload,
} from '@contracts/game';
import type { UpdateTeamNamesPayload } from '@contracts/room';
import type {
  ChangePlayerTeamPayload,
  LeaveRoomPayload,
  ModeratePlayerPayload,
  RevealBrokenHandPayload,
  RoomActionPayload,
} from '@contracts/socket';
import { IGameStateService } from './services/interfaces/game-state-service.interface';
import { IRoomService } from './services/interfaces/room-service.interface';
import { TrumpType } from './types/game.types';
import { ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { AuthService } from './auth/auth.service';
import { AuthenticatedUser } from './types/user.types';
import { IJoinRoomUseCase } from './use-cases/interfaces/join-room.use-case.interface';
import { ICreateRoomUseCase } from './use-cases/interfaces/create-room.use-case.interface';
import { ILeaveRoomUseCase } from './use-cases/interfaces/leave-room.use-case.interface';
import { IStartGameUseCase } from './use-cases/interfaces/start-game.use-case.interface';
import { ITogglePlayerReadyUseCase } from './use-cases/interfaces/toggle-player-ready.use-case.interface';
import { IChangePlayerTeamUseCase } from './use-cases/interfaces/change-player-team.use-case.interface';
import { IFillWithComUseCase } from './use-cases/interfaces/fill-with-com.use-case.interface';
import { GatewayEvent } from './use-cases/interfaces/gateway-event.interface';
import { IDeclareBlowUseCase } from './use-cases/interfaces/declare-blow.use-case.interface';
import { IPassBlowUseCase } from './use-cases/interfaces/pass-blow.use-case.interface';
import { ISelectNegriUseCase } from './use-cases/interfaces/select-negri.use-case.interface';
import {
  CompleteFieldTrigger,
  IPlayCardUseCase,
} from './use-cases/interfaces/play-card.use-case.interface';
import { ISelectBaseSuitUseCase } from './use-cases/interfaces/select-base-suit.use-case.interface';
import { IRevealBrokenHandUseCase } from './use-cases/interfaces/reveal-broken-hand.use-case.interface';
import { CompleteFieldResponse } from './use-cases/interfaces/complete-field.use-case.interface';
import { IProcessGameOverUseCase } from './use-cases/interfaces/process-game-over.use-case.interface';
import { IUpdateAuthUseCase } from './use-cases/interfaces/update-auth.use-case.interface';
import { IWatchRoomUseCase } from './use-cases/interfaces/watch-room.use-case.interface';
import { IActivityTrackerService } from './services/interfaces/activity-tracker-service.interface';
import { createSocketCorsOriginHandler } from './config/frontend-origins';
import { JoinRoomGatewayEffectsService } from './services/join-room-gateway-effects.service';
import { DisconnectGatewayEffectsService } from './services/disconnect-gateway-effects.service';
import { RoomUpdateGatewayEffectsService } from './services/room-update-gateway-effects.service';
import { StartGameGatewayEffectsService } from './services/start-game-gateway-effects.service';
import { SpectatorGatewayEffectsService } from './services/spectator-gateway-effects.service';
import { TurnMonitorService } from './services/turn-monitor.service';
import { ReconnectionUseCase } from './use-cases/reconnection.use-case';
import { ModeratePlayerUseCase } from './use-cases/moderate-player.use-case';
import { ShuffleTeamsUseCase } from './use-cases/shuffle-teams.use-case';
import { UpdateTeamNamesUseCase } from './use-cases/update-team-names.use-case';
import { Room } from './types/room.types';
import { toRoomContract, toRoomContracts } from './adapters/room-adapters';
import {
  ComAutoPlayRecoveryHandlers,
  ComAutoPlayRecoveryService,
} from './services/com-autoplay-recovery.service';
import { ConnectionGatewayEffectsService } from './services/connection-gateway-effects.service';
import { GameplayNotificationService } from './services/gameplay-notification.service';
import { AccountActionGateService } from './services/account-action-gate.service';
import { asSeatId } from './types/identity.types';
import type { SeatId } from './types/identity.types';

const DISCONNECT_TO_COM_TIMEOUT_MS = 2 * 60 * 1000;

@WebSocketGateway({
  cors: {
    origin: createSocketCorsOriginHandler(),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameGateway.name);
  private playerRooms: Map<string, string> = new Map(); // socketId -> roomId
  private readonly comAutoPlayRecoveryHandlers: ComAutoPlayRecoveryHandlers = {
    dispatchEvents: (events) => this.dispatchGameplayEvents(events),
    processFieldCompletion: (roomId, response) =>
      this.processFieldCompletionResult(roomId, response),
  };

  constructor(
    @Inject('IGameStateService')
    private readonly gameState: IGameStateService,
    @Inject('IRoomService')
    private readonly roomService: IRoomService,
    @Inject('IJoinRoomUseCase')
    private readonly joinRoomUseCase: IJoinRoomUseCase,
    @Inject('ICreateRoomUseCase')
    private readonly createRoomUseCase: ICreateRoomUseCase,
    @Inject('ILeaveRoomUseCase')
    private readonly leaveRoomUseCase: ILeaveRoomUseCase,
    @Inject('IStartGameUseCase')
    private readonly startGameUseCase: IStartGameUseCase,
    @Inject('IDeclareBlowUseCase')
    private readonly declareBlowUseCase: IDeclareBlowUseCase,
    @Inject('IPassBlowUseCase')
    private readonly passBlowUseCase: IPassBlowUseCase,
    @Inject('ISelectNegriUseCase')
    private readonly selectNegriUseCase: ISelectNegriUseCase,
    @Inject('IPlayCardUseCase')
    private readonly playCardUseCase: IPlayCardUseCase,
    @Inject('ISelectBaseSuitUseCase')
    private readonly selectBaseSuitUseCase: ISelectBaseSuitUseCase,
    @Inject('IRevealBrokenHandUseCase')
    private readonly revealBrokenHandUseCase: IRevealBrokenHandUseCase,
    @Inject('IProcessGameOverUseCase')
    private readonly processGameOverUseCase: IProcessGameOverUseCase,
    @Inject('IUpdateAuthUseCase')
    private readonly updateAuthUseCase: IUpdateAuthUseCase,
    @Inject('ITogglePlayerReadyUseCase')
    private readonly togglePlayerReadyUseCase: ITogglePlayerReadyUseCase,
    @Inject('IChangePlayerTeamUseCase')
    private readonly changePlayerTeamUseCase: IChangePlayerTeamUseCase,
    @Inject('IFillWithComUseCase')
    private readonly fillWithComUseCase: IFillWithComUseCase,
    private readonly authService: AuthService,
    @Inject('IWatchRoomUseCase')
    private readonly watchRoomUseCase: IWatchRoomUseCase,
    @Inject('IActivityTrackerService')
    private readonly activityTracker: IActivityTrackerService,
    private readonly turnMonitorService: TurnMonitorService,
    private readonly comAutoPlayRecoveryService: ComAutoPlayRecoveryService,
    private readonly reconnectionUseCase: ReconnectionUseCase,
    private readonly moderatePlayerUseCase: ModeratePlayerUseCase,
    private readonly shuffleTeamsUseCase: ShuffleTeamsUseCase,
    private readonly updateTeamNamesUseCase: UpdateTeamNamesUseCase,
    private readonly joinRoomGatewayEffectsService: JoinRoomGatewayEffectsService,
    private readonly disconnectGatewayEffectsService: DisconnectGatewayEffectsService,
    private readonly roomUpdateGatewayEffectsService: RoomUpdateGatewayEffectsService,
    private readonly startGameGatewayEffectsService: StartGameGatewayEffectsService,
    private readonly spectatorGatewayEffectsService: SpectatorGatewayEffectsService,
    private readonly connectionGatewayEffectsService: ConnectionGatewayEffectsService,
    private readonly gameplayNotificationService: GameplayNotificationService,
    private readonly accountActionGateService: AccountActionGateService,
  ) {}

  /**
   * 認証済みユーザーまたはauth.nameから適切な名前を取得するヘルパーメソッド
   */
  private getPlayerName(
    authenticatedUser: AuthenticatedUser | null,
    auth: Record<string, unknown>,
  ): string | undefined {
    if (authenticatedUser) {
      const name =
        authenticatedUser.profile?.displayName || authenticatedUser.email;
      if (name) {
        return name;
      }
    }

    const authName = typeof auth.name === 'string' ? auth.name : undefined;
    return authName;
  }

  private getAuthenticatedUser(client: Socket): AuthenticatedUser | undefined {
    return (client.data as { user?: AuthenticatedUser }).user;
  }

  private getActorId(client: Socket): string {
    return this.getAuthenticatedUser(client)?.id ?? client.id;
  }

  private async resolveClientRoomSeatId(
    roomId: string,
    client: Socket,
  ): Promise<SeatId> {
    const authenticatedUser = this.getAuthenticatedUser(client);
    if (!authenticatedUser) {
      throw new Error('Authenticated user is required to resolve a room seat');
    }

    const room = await this.roomService.getRoom(roomId);
    if (!room) {
      throw new Error(`Room not found while resolving player: ${roomId}`);
    }

    const roomPlayers = room.players.filter(
      (player) => !player.isCOM && player.userId === authenticatedUser.id,
    );
    if (roomPlayers.length !== 1) {
      throw new Error(
        `Authenticated room player is ambiguous or missing: room=${roomId} user=${authenticatedUser.id} matches=${roomPlayers.length}`,
      );
    }

    return roomPlayers[0].seatId;
  }

  private async rejectInactiveMutatingAction(
    client: Socket,
    action: string,
  ): Promise<boolean> {
    const gate = await this.accountActionGateService.ensureActiveSocketActor(
      client,
      action,
    );
    if (gate.allowed) {
      if (gate.authenticatedUser) {
        (client.data as { user?: AuthenticatedUser }).user =
          gate.authenticatedUser;
      }
      return false;
    }

    const errorMessage = gate.errorMessage ?? 'Authentication required';
    client.emit('error-message', errorMessage);
    client.emit('auth-error', errorMessage);
    return true;
  }

  private normalizeGatewayPayload(event: GatewayEvent): unknown {
    if (event.event === 'rooms-list' && Array.isArray(event.payload)) {
      return toRoomContracts(event.payload as Room[]);
    }

    return event.payload;
  }

  private emitRoomsListToAll(rooms: Room[]): void {
    this.server.emit(
      'rooms-list',
      this.roomUpdateGatewayEffectsService.buildRoomsListView(rooms),
    );
  }

  private emitRoomsListToSocket(client: Socket, rooms: Room[]): void {
    client.emit(
      'rooms-list',
      this.roomUpdateGatewayEffectsService.buildRoomsListView(rooms),
    );
  }

  private queueSpectatorSnapshot(roomId: string): void {
    this.spectatorGatewayEffectsService.queueSnapshot(this.server, roomId, () =>
      this.watchRoomUseCase.buildSnapshot(roomId),
    );
  }

  private dispatchEvents(events?: GatewayEvent[]) {
    if (!events) {
      return;
    }

    events.forEach((event) => {
      const payload = this.normalizeGatewayPayload(event);
      const emit = () => {
        switch (event.scope) {
          case 'room':
            if (event.roomId) {
              const roomEmitter = this.server.to(event.roomId);
              if (event.excludeSocketId) {
                roomEmitter
                  .except(event.excludeSocketId)
                  .emit(event.event, payload);
              } else {
                roomEmitter.emit(event.event, payload);
              }
              if (
                event.event === 'update-turn' &&
                typeof event.payload === 'string'
              ) {
                void this.startTurnAckMonitor(
                  event.roomId,
                  asSeatId(event.payload),
                );
              }
              this.queueSpectatorSnapshot(event.roomId);
            }
            break;
          case 'socket':
            if (event.socketId) {
              this.server.to(event.socketId).emit(event.event, payload);
            }
            break;
          case 'all':
            this.server.emit(event.event, payload);
            break;
        }
      };

      if (event.delayMs && event.delayMs > 0) {
        setTimeout(() => {
          void this.emitUnlessStale(event, emit);
        }, event.delayMs);
      } else {
        emit();
      }
    });
  }

  /**
   * A delayed `update-turn` carries a seat frozen at build time. If the turn
   * already advanced (e.g. the first blower acted before the game-start
   * reveal delay elapsed), rebroadcasting the stale seat would roll every
   * client's turn back and point the ack monitor at the wrong player, so the
   * event is dropped — the action that advanced the turn already emitted the
   * fresh one.
   */
  private async emitUnlessStale(
    event: GatewayEvent,
    emit: () => void,
  ): Promise<void> {
    if (
      event.event === 'update-turn' &&
      event.scope === 'room' &&
      event.roomId &&
      typeof event.payload === 'string'
    ) {
      try {
        const roomGameState = await this.roomService.getRoomGameState(
          event.roomId,
        );
        const currentSeatId = roomGameState.getState().currentSeatId ?? null;
        if (currentSeatId !== event.payload) {
          return;
        }
      } catch {
        // Room is gone; nothing to emit to.
        return;
      }
    }

    emit();
  }

  private dispatchGameplayEvents(events?: GatewayEvent[]): void {
    this.dispatchEvents(events);
  }

  private clearTurnAckMonitor(roomId: string): void {
    this.turnMonitorService.clearMonitor(roomId);
  }

  private async forceReplacePlayerWithCOM(
    roomId: string,
    seatId: SeatId,
    message: string,
  ): Promise<boolean> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const room = await this.roomService.getRoom(roomId);
    const targetPlayer = room?.players.find(
      (player) => player.seatId === seatId,
    );
    const targetSocketId =
      roomGameState.getPlayerConnectionState(seatId)?.socketId;
    const targetSocket = targetSocketId
      ? this.server.sockets.sockets.get(targetSocketId)
      : undefined;

    if (targetSocket) {
      await targetSocket.leave(roomId);
      this.playerRooms.delete(targetSocket.id);
      targetSocket.emit('error-message', message);
      targetSocket.emit('back-to-lobby');
    }

    const converted = await this.roomService.convertPlayerToCOM(roomId, seatId);
    if (!converted) {
      return false;
    }

    const updatedRoom = await this.roomService.getRoom(roomId);
    this.server.to(roomId).emit('player-converted-to-com', {
      seatId,
      playerName: targetPlayer?.name ?? seatId,
      message,
    });
    const updatedField =
      roomGameState.getState().playState?.currentField ?? null;
    if (updatedField) {
      this.server.to(roomId).emit('field-updated', updatedField);
    }
    this.queueSpectatorSnapshot(roomId);
    if (updatedRoom) {
      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: updatedRoom,
          scope: 'room',
          roomId,
        }),
      );
    }
    this.emitRoomsListToAll(await this.roomService.listRooms());
    this.triggerComAutoPlayIfNeeded(roomId);
    return true;
  }

  private async startTurnAckMonitor(
    roomId: string,
    seatId: SeatId,
  ): Promise<void> {
    await this.turnMonitorService.startMonitor(
      roomId,
      seatId,
      this.server,
      async (monitoredRoomId, monitoredSeatId) => {
        await this.forceReplacePlayerWithCOM(
          monitoredRoomId,
          monitoredSeatId,
          'Player became unresponsive during their turn - converted to COM',
        );
      },
    );
  }

  private isPlayerIdle(roomId: string, seatId: SeatId): boolean {
    return this.turnMonitorService.isPlayerIdle(roomId, seatId);
  }

  private finalizeBrokenHandAfterDelay(
    followUp: { roomId: string; seatId: SeatId },
    delayMs: number,
  ): void {
    setTimeout(() => {
      void this.revealBrokenHandUseCase
        .finalize(followUp)
        .then((completion) => {
          if (!completion.success) {
            console.error(
              'Failed to finalize broken hand sequence:',
              completion.error,
            );
            return;
          }

          this.dispatchGameplayEvents(completion.events);
          this.triggerComAutoPlayIfNeeded(followUp.roomId);
        })
        .catch((error) =>
          console.error('Error finalizing broken hand sequence:', error),
        );
    }, delayMs);
  }

  private async processFieldCompletionResult(
    roomId: string,
    response: CompleteFieldResponse,
  ) {
    if (!response.success) {
      this.logger.warn(
        `Field completion failed for room ${roomId}: ${response.error}`,
      );
      return;
    }

    this.dispatchGameplayEvents(response.events);
    this.dispatchGameplayEvents(response.delayedEvents);

    if (response.gameOver) {
      await this.processGameOverUseCase.execute({
        roomId,
        winningTeam: response.gameOver.winningTeam,
        teamScores: response.gameOver.teamScores,
        resetDelayMs: response.gameOver.resetDelayMs,
      });
      const closeDelay = response.gameOver.resetDelayMs ?? 0;
      setTimeout(() => {
        void this.closeFinishedRoom(roomId);
      }, closeDelay);
    }
  }

  private async closeFinishedRoom(roomId: string): Promise<void> {
    try {
      this.clearTurnAckMonitor(roomId);
      this.comAutoPlayRecoveryService.clearRoom(roomId);

      const socketIds = Array.from(
        this.server.sockets.adapter.rooms.get(roomId) ?? [],
      );

      for (const socketId of socketIds) {
        const socket = this.server.sockets.sockets.get(socketId);
        this.playerRooms.delete(socketId);

        if (socket) {
          await socket.leave(roomId);
          this.server.to(socketId).emit('back-to-lobby');
        }
      }

      await this.spectatorGatewayEffectsService.sendRoomBackToLobby(
        this.server,
        roomId,
      );

      await this.roomService.releaseRoomResources(roomId);
      const roomsList = await this.roomService.listRooms();
      this.emitRoomsListToAll(roomsList);
    } catch (error) {
      console.error('Failed to close finished room:', error);
    }
  }

  private triggerComAutoPlayIfNeeded(roomId: string): void {
    this.comAutoPlayRecoveryService.trigger(
      roomId,
      this.comAutoPlayRecoveryHandlers,
    );
  }

  /**
   * Holds COM back until the room's delayed events have gone out, so it never
   * acts while clients are still showing the animation those delays reserve.
   */
  private triggerComAutoPlayAfterEvents(
    roomId: string,
    events: GatewayEvent[],
  ): void {
    const maxDelay = events.reduce(
      (longest, event) => Math.max(longest, event.delayMs ?? 0),
      0,
    );

    if (maxDelay <= 0) {
      this.triggerComAutoPlayIfNeeded(roomId);
      return;
    }

    this.comAutoPlayRecoveryService.triggerAfterDelay(
      roomId,
      this.comAutoPlayRecoveryHandlers,
      maxDelay + 100,
    );
  }

  private scheduleFieldCompletion(trigger: CompleteFieldTrigger): void {
    this.comAutoPlayRecoveryService.scheduleFieldCompletion(
      trigger,
      this.comAutoPlayRecoveryHandlers,
    );
  }

  private async restoreRoomSession(params: {
    client: Socket;
    roomId: string;
    authenticatedUser: AuthenticatedUser;
  }): Promise<void> {
    const { client, roomId, authenticatedUser } = params;
    const previousControllerSocketId =
      await this.connectionGatewayEffectsService.findExistingControllerSocketId(
        {
          server: this.server,
          playerRooms: this.playerRooms,
          roomId,
          userId: authenticatedUser.id,
        },
      );
    const result = await this.reconnectionUseCase.execute({
      roomId,
      socketId: client.id,
      authenticatedUser,
    });

    if (!result.success) {
      await this.connectionGatewayEffectsService.sendBackToLobby({
        client,
        playerRooms: this.playerRooms,
        reason: result.reason,
        code: result.code,
        roomId,
      });
      return;
    }

    if (
      previousControllerSocketId &&
      previousControllerSocketId !== client.id
    ) {
      await this.connectionGatewayEffectsService.sendSocketBackToLobby({
        server: this.server,
        playerRooms: this.playerRooms,
        socketId: previousControllerSocketId,
        roomId,
      });
    }

    this.playerRooms.set(client.id, roomId);
    await client.join(roomId);

    if (result.mode === 'waiting-room') {
      const roomEntryEvents =
        await this.joinRoomGatewayEffectsService.buildRoomEntryEvents({
          clientId: client.id,
          room: result.room,
          selfPlayer: {
            seatId: result.selfSeatId,
            name: result.selfName,
            team: result.selfTeam,
          },
          isHost: result.isHost,
          roomStatus: result.room.status,
          roomsList: result.roomsList,
          roomsListScope: 'socket',
        });
      this.dispatchEvents(roomEntryEvents);
      return;
    }

    const activeReconnectEvents =
      await this.joinRoomGatewayEffectsService.buildActiveReconnectEvents({
        clientId: client.id,
        roomId,
        room: result.room,
        gameState: result.gameState,
        reconnectToken: result.reconnectToken,
      });
    this.dispatchEvents(activeReconnectEvents);
    if (result.currentTurnSeatId) {
      void this.startTurnAckMonitor(roomId, result.currentTurnSeatId);
    }
    this.triggerComAutoPlayIfNeeded(roomId);
  }

  //-------Connection-------
  async handleConnection(client: Socket) {
    this.activityTracker.incrementConnections();

    const auth = client.handshake.auth || {};
    const roomId = typeof auth.roomId === 'string' ? auth.roomId : undefined;
    const supabaseToken =
      typeof auth.token === 'string' ? auth.token : undefined;

    // Authentication required
    let authenticatedUser: AuthenticatedUser | null = null;
    if (!supabaseToken) {
      console.warn('[Auth] No authentication token provided');
      client.emit('error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    try {
      authenticatedUser =
        await this.authService.getUserFromSocketToken(supabaseToken);
      if (authenticatedUser) {
        // Store authenticated user in socket data
        (client.data as { user: AuthenticatedUser }).user = authenticatedUser;
      } else {
        console.warn('[Auth] Invalid authentication token');
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect();
        return;
      }
    } catch (error) {
      console.warn(
        '[Auth] Failed to authenticate user with Supabase token:',
        error,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
      return;
    }

    if (roomId && authenticatedUser) {
      await this.restoreRoomSession({ client, roomId, authenticatedUser });
      return;
    }

    // 新規認証済みプレイヤーとして追加
    const displayName =
      authenticatedUser.profile?.displayName ||
      authenticatedUser.email ||
      'User';
    const userId = authenticatedUser.id;

    const syncResult = this.gameState.upsertSessionUser({
      socketId: client.id,
      name: displayName,
      userId,
      isAuthenticated: true,
    });

    if (syncResult.created || syncResult.changed) {
      const users = this.gameState.getSessionUsers();
      this.server.emit('update-users', users);
    } else {
      this.server.emit('update-users', this.gameState.getSessionUsers());
    }
  }

  @SubscribeMessage('profile-updated')
  handleProfileUpdated(@ConnectedSocket() client: Socket): void {
    const authenticatedUser = this.getAuthenticatedUser(client);
    if (!authenticatedUser) {
      client.emit('error-message', 'Authentication required');
      return;
    }

    const payload = { userId: authenticatedUser.id };
    const roomId = this.playerRooms.get(client.id);

    if (roomId) {
      this.server.to(roomId).emit('profile-updated', payload);
      return;
    }

    this.server.emit('profile-updated', payload);
  }

  async handleDisconnect(client: Socket) {
    this.activityTracker.decrementConnections();

    if (await this.spectatorGatewayEffectsService.handleDisconnect(client)) {
      return;
    }

    const roomId = this.playerRooms.get(client.id);
    if (roomId) {
      this.playerRooms.delete(client.id);
      await client.leave(roomId);
      const authenticatedUser = this.getAuthenticatedUser(client);
      const preparation =
        await this.disconnectGatewayEffectsService.prepareDisconnect({
          roomId,
          socketId: client.id,
          displayName: authenticatedUser?.profile?.displayName,
        });

      if (!preparation) {
        return;
      }

      if (
        this.turnMonitorService.isMonitoringPlayer(roomId, preparation.seatId)
      ) {
        this.clearTurnAckMonitor(roomId);
      }

      this.dispatchEvents(preparation.events);

      const timeoutMs =
        preparation.timeoutMode === 'convert-to-com'
          ? DISCONNECT_TO_COM_TIMEOUT_MS
          : 10000;
      const timeout: NodeJS.Timeout = setTimeout(() => {
        void this.disconnectGatewayEffectsService
          .buildTimeoutEvents({
            roomId,
            seatId: preparation.seatId,
            playerName: preparation.playerName,
            timeoutMode: preparation.timeoutMode,
            membership: preparation.membership,
          })
          .then((events) => {
            this.dispatchEvents(events);
            if (
              events.some((event) => event.event === 'player-converted-to-com')
            ) {
              this.triggerComAutoPlayIfNeeded(roomId);
            }
          })
          .catch((error) => {
            console.error(
              '[Disconnect] Error processing disconnect timeout:',
              error,
            );
          });
      }, timeoutMs);

      preparation.roomGameState.setDisconnectTimeout(
        preparation.seatId,
        timeout,
      );
    }
  }
  //-------Connection-------

  //-------Room-------
  @SubscribeMessage('create-room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      name: string;
      pointsToWin: number;
      teamAssignmentMethod: 'random' | 'host-choice';
    },
  ) {
    this.activityTracker.recordActivity();

    if (await this.rejectInactiveMutatingAction(client, 'create room')) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const auth = client.handshake.auth || {};

      // 認証済みユーザー情報を取得
      const authenticatedUser = this.getAuthenticatedUser(client);

      // 共通ヘルパーメソッドを使用して名前を取得
      const playerName = this.getPlayerName(authenticatedUser || null, auth);
      const result = await this.createRoomUseCase.execute({
        roomName: data.name,
        pointsToWin: data.pointsToWin,
        teamAssignmentMethod: data.teamAssignmentMethod,
        playerName,
        socketId: client.id,
        authenticatedUser,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.errorMessage || 'Failed to create room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const { room: updatedRoom, hostPlayer, roomsList } = result.data;
      await this.spectatorGatewayEffectsService.leaveCurrentRoom(client);
      this.playerRooms.set(client.id, updatedRoom.id);
      await client.join(updatedRoom.id);
      const createRoomEvents =
        await this.joinRoomGatewayEffectsService.buildRoomEntryEvents({
          clientId: client.id,
          room: updatedRoom,
          selfPlayer: {
            seatId: asSeatId(hostPlayer.seatId),
            name: hostPlayer.name,
            team: hostPlayer.team,
          },
          isHost: true,
          roomStatus: updatedRoom.status,
          roomsList,
          roomsListScope: 'all',
        });
      this.dispatchEvents(createRoomEvents);

      return {
        success: true,
        room: (
          await this.roomUpdateGatewayEffectsService.buildRoomView(updatedRoom)
        ).room,
      };
    } catch (error) {
      console.error('Error in handleCreateRoom:', error);
      client.emit('error-message', 'Failed to create room');
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.activityTracker.recordActivity();

    if (await this.rejectInactiveMutatingAction(client, 'join room')) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const currentRoomId = this.playerRooms.get(client.id);
      const authenticatedUser = this.getAuthenticatedUser(client);
      const previousControllerSocketId = authenticatedUser
        ? await this.connectionGatewayEffectsService.findExistingControllerSocketId(
            {
              server: this.server,
              playerRooms: this.playerRooms,
              roomId: data.roomId,
              userId: authenticatedUser.id,
            },
          )
        : null;
      await this.spectatorGatewayEffectsService.leaveCurrentRoom(client);

      const result = await this.joinRoomUseCase.execute({
        socketId: client.id,
        targetRoomId: data.roomId,
        currentRoomId,
        authenticatedUser,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.errorMessage ?? 'Failed to join room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const normalizedUser = result.normalizedUser;
      if (!normalizedUser) {
        const errorMessage = 'Authentication required to join room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      if (
        previousControllerSocketId &&
        previousControllerSocketId !== client.id
      ) {
        await this.connectionGatewayEffectsService.sendSocketBackToLobby({
          server: this.server,
          playerRooms: this.playerRooms,
          socketId: previousControllerSocketId,
          roomId: data.roomId,
        });
      }

      if (currentRoomId && currentRoomId !== data.roomId) {
        await client.leave(currentRoomId);
      }

      this.playerRooms.set(client.id, data.roomId);
      await client.join(data.roomId);

      const joinEffects = await this.joinRoomGatewayEffectsService.buildEffects(
        {
          clientId: client.id,
          roomId: data.roomId,
          currentRoomId,
          normalizedUser,
          previousRoomNotification: result.previousRoomNotification,
          joinData: result.data,
        },
      );

      this.dispatchEvents(joinEffects.events);

      return {
        success: true,
        room: (
          await this.roomUpdateGatewayEffectsService.buildRoomView(
            joinEffects.room,
          )
        ).room,
      };
    } catch (error) {
      console.error('Failed to join room:', error);
      client.emit('error-message', 'Failed to join room');
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('watch-room')
  async handleWatchRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.activityTracker.recordActivity();

    try {
      if (this.playerRooms.has(client.id)) {
        const errorMessage = 'Already seated in a room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const result = await this.watchRoomUseCase.execute({
        roomId: data.roomId,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.error ?? 'Failed to watch room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      await this.spectatorGatewayEffectsService.watchRoom(
        client,
        data.roomId,
        result.data.gameState,
      );

      return {
        success: true,
        room: toRoomContract(result.data.room),
      };
    } catch (error) {
      console.error('Error in handleWatchRoom:', error);
      client.emit('error-message', 'Failed to watch room');
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('leave-watch-room')
  async handleLeaveWatchRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const success = await this.spectatorGatewayEffectsService.leaveRoom(
      client,
      data.roomId,
    );
    if (!success) {
      return { success: false, error: 'Not watching this room' };
    }

    return { success: true };
  }

  @SubscribeMessage('list-rooms')
  async handleListRooms(client: Socket) {
    try {
      const rooms = await this.roomService.listRooms();
      this.emitRoomsListToSocket(client, rooms);
    } catch (error) {
      console.error('Failed to list rooms:', error);
    }
  }

  @SubscribeMessage('toggle-player-ready')
  async handleTogglePlayerReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RoomActionPayload,
  ) {
    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'toggle ready')
    ) {
      return { success: false, error: 'Spectators cannot toggle ready' };
    }
    if (await this.rejectInactiveMutatingAction(client, 'toggle ready')) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const actorSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const result = await this.togglePlayerReadyUseCase.execute({
        roomId: data.roomId,
        actorSeatId,
      });

      if (!result.success || !result.updatedRoom) {
        const error = result.error || 'Failed to toggle ready state';
        client.emit('error-message', error);
        return { success: false, error };
      }

      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: result.updatedRoom,
          scope: 'room',
          roomId: data.roomId,
        }),
      );
      return { success: true };
    } catch (error) {
      console.error('Error in handleTogglePlayerReady:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveRoomPayload,
  ) {
    try {
      const authenticatedUser = this.getAuthenticatedUser(client);
      const seatId = await this.resolveClientRoomSeatId(data.roomId, client);
      const result = await this.leaveRoomUseCase.execute({
        seatId,
        roomId: data.roomId,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.errorMessage || 'Failed to leave room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const {
        seatId: leftSeatId,
        roomDeleted,
        roomsList,
        updatedPlayers,
        gamePausedMessage,
        blowState,
      } = result.data;

      if (roomDeleted) {
        this.clearTurnAckMonitor(data.roomId);
        this.comAutoPlayRecoveryService.clearRoom(data.roomId);
        await this.connectionGatewayEffectsService.sendRoomPlayersBackToLobby({
          server: this.server,
          playerRooms: this.playerRooms,
          roomId: data.roomId,
        });
        await this.spectatorGatewayEffectsService.sendRoomBackToLobby(
          this.server,
          data.roomId,
        );
        this.emitRoomsListToAll(roomsList);
        return { success: true };
      }

      await this.connectionGatewayEffectsService.sendUserSocketsBackToLobby({
        server: this.server,
        playerRooms: this.playerRooms,
        roomId: data.roomId,
        userId: authenticatedUser?.id,
        fallbackSocketId: client.id,
      });

      this.server.to(data.roomId).emit('player-left', {
        seatId: leftSeatId,
        roomId: data.roomId,
      });
      this.queueSpectatorSnapshot(data.roomId);

      this.emitRoomsListToAll(roomsList);
      if (updatedPlayers) {
        this.dispatchEvents([
          this.roomUpdateGatewayEffectsService.buildPlayersEvent({
            players: updatedPlayers,
            scope: 'room',
            roomId: data.roomId,
          }),
        ]);
      }
      if (blowState) {
        this.server.to(data.roomId).emit('blow-updated', {
          declarations: blowState.declarations,
          actionHistory: blowState.actionHistory,
          currentHighest: blowState.currentHighestDeclaration,
          lastPasserSeatId: blowState.lastPasserSeatId,
        });
      }

      if (gamePausedMessage) {
        this.server
          .to(data.roomId)
          .emit('game-paused', { message: gamePausedMessage });
        this.queueSpectatorSnapshot(data.roomId);
      } else if (!roomDeleted) {
        this.triggerComAutoPlayIfNeeded(data.roomId);
      }

      return { success: true };
    } catch (error) {
      console.error('Error in handleLeaveRoom:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('moderate-player')
  async handleModeratePlayer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: ModeratePlayerPayload,
  ): Promise<{ success: boolean; error?: string }> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(
        client,
        'moderate players',
      )
    ) {
      return { success: false, error: 'Spectators cannot moderate players' };
    }
    if (await this.rejectInactiveMutatingAction(client, 'moderate players')) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const requesterSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const result = await this.moderatePlayerUseCase.execute({
        roomId: data.roomId,
        requesterSeatId,
        targetSeatId: data.targetSeatId,
        action: data.action,
        isPlayerIdle: this.isPlayerIdle(data.roomId, data.targetSeatId),
      });

      if (!result.success) {
        client.emit('error-message', result.error);
        return { success: false, error: result.error };
      }

      if (result.targetSocketId) {
        const targetSocket = this.server.sockets.sockets.get(
          result.targetSocketId,
        );
        if (targetSocket) {
          await targetSocket.leave(data.roomId);
          this.playerRooms.delete(result.targetSocketId);
          targetSocket.emit(
            'error-message',
            result.mode === 'remove'
              ? 'You were removed from the room by the host'
              : result.message,
          );
          targetSocket.emit('back-to-lobby');
        }
      }

      if (result.mode === 'remove') {
        if (result.roomDeleted) {
          this.clearTurnAckMonitor(data.roomId);
          this.comAutoPlayRecoveryService.clearRoom(data.roomId);
          this.emitRoomsListToAll(result.roomsList);
          return { success: true };
        }

        if (result.updatedRoom) {
          this.dispatchEvents(
            await this.roomUpdateGatewayEffectsService.buildRoomEvents({
              room: result.updatedRoom,
              scope: 'room',
              roomId: data.roomId,
            }),
          );
        }
        this.server.to(data.roomId).emit('player-left', {
          seatId: result.seatId,
          roomId: data.roomId,
        });
        this.queueSpectatorSnapshot(data.roomId);
        this.emitRoomsListToAll(result.roomsList);
        return { success: true };
      }

      this.clearTurnAckMonitor(data.roomId);
      this.server.to(data.roomId).emit('player-converted-to-com', {
        seatId: result.seatId,
        playerName: result.playerName,
        message: result.message,
      });
      this.queueSpectatorSnapshot(data.roomId);
      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: result.updatedRoom,
          scope: 'room',
          roomId: data.roomId,
        }),
      );
      this.server.to(data.roomId).emit('blow-updated', {
        declarations: result.blowState.declarations,
        actionHistory: result.blowState.actionHistory,
        currentHighest: result.blowState.currentHighestDeclaration,
        lastPasserSeatId: result.blowState.lastPasserSeatId,
      });
      this.emitRoomsListToAll(result.roomsList);
      this.triggerComAutoPlayIfNeeded(data.roomId);
      return { success: true };
    } catch (error) {
      console.error('Error in handleModeratePlayer:', error);
      client.emit('error-message', 'Internal server error');
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('turn-ack')
  async handleTurnAck(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: string },
  ): Promise<void> {
    if (this.spectatorGatewayEffectsService.isSpectatorSocket(client.id)) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'acknowledge turn')) {
      return;
    }

    const roomId = data.roomId || this.playerRooms.get(client.id);
    if (!roomId) {
      return;
    }
    await this.turnMonitorService.acknowledge(
      roomId,
      client.id,
      this.getAuthenticatedUser(client)?.id,
    );
    this.triggerComAutoPlayIfNeeded(roomId);
  }

  @SubscribeMessage('sync-game-state')
  async handleSyncGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SyncGameStatePayload,
  ): Promise<void> {
    if (await this.rejectInactiveMutatingAction(client, 'sync game state')) {
      return;
    }

    const roomId = data.roomId ?? this.playerRooms.get(client.id);
    if (!roomId) {
      return;
    }

    let authenticatedUser = this.getAuthenticatedUser(client);
    if (!authenticatedUser) {
      const auth = client.handshake.auth as { token?: unknown };
      const token = auth.token;
      if (typeof token !== 'string') {
        return;
      }

      const refreshedAuthenticatedUser =
        await this.authService.getUserFromSocketToken(token);
      if (!refreshedAuthenticatedUser) {
        return;
      }
      authenticatedUser = refreshedAuthenticatedUser;
      (client.data as { user?: AuthenticatedUser }).user = authenticatedUser;
    }

    const activeGameSnapshot =
      await this.reconnectionUseCase.getActiveGameSnapshot({
        roomId,
        authenticatedUser,
      });
    if (activeGameSnapshot) {
      this.playerRooms.set(client.id, roomId);
      await client.join(roomId);
      client.emit('game-state', activeGameSnapshot.gameState);
      client.emit('reconnect-token', activeGameSnapshot.reconnectToken);
      return;
    }

    const waitingRoomSnapshot =
      await this.reconnectionUseCase.getWaitingRoomSnapshot({
        roomId,
        authenticatedUser,
      });
    if (!waitingRoomSnapshot) {
      return;
    }

    this.playerRooms.set(client.id, roomId);
    await client.join(roomId);
    const roomEntryEvents =
      await this.joinRoomGatewayEffectsService.buildRoomEntryEvents({
        clientId: client.id,
        room: waitingRoomSnapshot.room,
        selfPlayer: {
          seatId: waitingRoomSnapshot.selfSeatId,
          name: waitingRoomSnapshot.selfName,
          team: waitingRoomSnapshot.selfTeam,
        },
        isHost: waitingRoomSnapshot.isHost,
        roomStatus: waitingRoomSnapshot.room.status,
        roomsList: waitingRoomSnapshot.roomsList,
        roomsListScope: 'socket',
      });
    this.dispatchEvents(roomEntryEvents);
  }

  @SubscribeMessage('change-player-team')
  async handleChangePlayerTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: ChangePlayerTeamPayload,
  ): Promise<{ success: boolean }> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'change teams')
    ) {
      return { success: false };
    }
    if (await this.rejectInactiveMutatingAction(client, 'change teams')) {
      return { success: false };
    }

    try {
      const actorSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const result = await this.changePlayerTeamUseCase.execute({
        roomId: data.roomId,
        actorSeatId,
        teamChanges: data.teamChanges,
      });

      if (!result.success || !result.updatedRoom) {
        const error = result.error || 'Failed to change teams';
        client.emit('error-message', error);
        return { success: false };
      }

      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: result.updatedRoom,
          scope: 'room',
          roomId: data.roomId,
        }),
      );

      return { success: true };
    } catch (error) {
      console.error('Error in handleChangePlayerTeam:', error);
      client.emit('error-message', 'Internal server error');
      return { success: false };
    }
  }

  @SubscribeMessage('shuffle-teams')
  async handleShuffleTeams(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RoomActionPayload,
  ): Promise<{ success: boolean }> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'shuffle teams')
    ) {
      return { success: false };
    }
    if (await this.rejectInactiveMutatingAction(client, 'shuffle teams')) {
      return { success: false };
    }

    try {
      const actorSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const result = await this.shuffleTeamsUseCase.execute({
        roomId: data.roomId,
        actorSeatId,
      });
      if (!result.success || !result.updatedRoom) {
        client.emit('error-message', result.error || 'Failed to change teams');
        return { success: false };
      }

      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: result.updatedRoom,
          scope: 'room',
          roomId: data.roomId,
        }),
      );
      return { success: true };
    } catch (error) {
      console.error('Error in handleShuffleTeams:', error);
      client.emit('error-message', 'Internal server error');
      return { success: false };
    }
  }

  @SubscribeMessage('update-team-names')
  async handleUpdateTeamNames(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UpdateTeamNamesPayload,
  ): Promise<{ success: boolean }> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(
        client,
        'update team names',
      )
    ) {
      return { success: false };
    }
    if (await this.rejectInactiveMutatingAction(client, 'update team names')) {
      return { success: false };
    }

    try {
      const actorSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const result = await this.updateTeamNamesUseCase.execute({
        ...data,
        actorSeatId,
      });
      if (!result.success || !result.updatedRoom) {
        client.emit(
          'error-message',
          result.error || 'Failed to update team names',
        );
        return { success: false };
      }

      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: result.updatedRoom,
          scope: 'room',
          roomId: data.roomId,
        }),
      );
      return { success: true };
    } catch (error) {
      console.error('Error in handleUpdateTeamNames:', error);
      client.emit('error-message', 'Internal server error');
      return { success: false };
    }
  }

  @SubscribeMessage('fill-with-com')
  async handleFillWithCom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RoomActionPayload,
  ): Promise<{ success: boolean }> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'fill with COM')
    ) {
      return { success: false };
    }
    if (await this.rejectInactiveMutatingAction(client, 'fill with COM')) {
      return { success: false };
    }

    try {
      const actorSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const result = await this.fillWithComUseCase.execute({
        roomId: data.roomId,
        actorSeatId,
      });

      if (!result.success || !result.updatedRoom) {
        const error = result.error || 'Failed to fill with COM players';
        client.emit('error-message', error);
        return { success: false };
      }

      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: result.updatedRoom,
          scope: 'room',
          roomId: data.roomId,
        }),
      );
      return { success: true };
    } catch (error) {
      console.error('Error in handleFillWithCom:', error);
      client.emit('error-message', 'Failed to fill with COM players');
      return { success: false };
    }
  }
  //-------Room-------

  //-------Game-------
  @SubscribeMessage('start-game')
  async handleStartGame(client: Socket, data: RoomActionPayload) {
    this.activityTracker.recordActivity();

    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'start the game')
    ) {
      return { success: false, error: 'Spectators cannot start the game' };
    }
    if (await this.rejectInactiveMutatingAction(client, 'start the game')) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const actorSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const result = await this.startGameUseCase.execute({
        actorSeatId,
        roomId: data.roomId,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.errorMessage || 'Failed to start game';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const {
        players,
        pointsToWin,
        updatePhase,
        currentTurnSeatId,
        firstTurnRevealEnabled,
      } = result.data;
      const startGameEvents =
        await this.startGameGatewayEffectsService.buildEvents({
          roomId: data.roomId,
          players,
          pointsToWin,
          updatePhase,
          currentTurnSeatId,
          firstTurnRevealEnabled,
        });

      this.dispatchGameplayEvents(startGameEvents);
      void this.gameplayNotificationService.notifyGameStarted({
        roomId: data.roomId,
        initiatingActorId: actorSeatId,
        currentTurnSeatId,
      });

      this.triggerComAutoPlayAfterEvents(data.roomId, startGameEvents);

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to start game', error);
      client.emit('error-message', 'Failed to start game');
      return { success: false, error: 'Failed to start game' };
    }
  }

  @SubscribeMessage('declare-blow')
  async handleDeclareBlow(
    client: Socket,
    data: {
      roomId: string;
      declaration: { trumpType: TrumpType; numberOfPairs: number };
    },
  ): Promise<void> {
    this.activityTracker.recordActivity();

    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'declare blow')
    ) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'declare blow')) {
      return;
    }

    try {
      const actorId = this.getActorId(client);
      const result = await this.declareBlowUseCase.execute({
        roomId: data.roomId,
        actorId,
        declaration: data.declaration,
      });

      if (!result.success) {
        this.logger.warn(
          `declare-blow rejected room=${data.roomId} user=${actorId} reason=${result.error ?? 'unknown'} declaration=${JSON.stringify(data.declaration)}`,
        );
        client.emit('error-message', result.error ?? 'Failed to declare blow');
        return;
      }

      this.dispatchGameplayEvents(result.events);
      this.dispatchGameplayEvents(result.delayedEvents);
      this.triggerComAutoPlayAfterEvents(
        data.roomId,
        result.delayedEvents ?? [],
      );
    } catch (error) {
      console.error('Error in handleDeclareBlow:', error);
      client.emit('error-message', 'Failed to declare blow');
    }
  }

  @SubscribeMessage('pass-blow')
  async handlePassBlow(
    client: Socket,
    data: { roomId: string },
  ): Promise<void> {
    this.activityTracker.recordActivity();

    if (this.spectatorGatewayEffectsService.rejectAction(client, 'pass blow')) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'pass blow')) {
      return;
    }

    try {
      const actorId = this.getActorId(client);
      const result = await this.passBlowUseCase.execute({
        roomId: data.roomId,
        actorId,
      });

      if (!result.success) {
        this.logger.warn(
          `pass-blow rejected room=${data.roomId} user=${actorId} reason=${result.error ?? 'unknown'}`,
        );
        client.emit('error-message', result.error ?? 'Failed to pass blow');
        return;
      }

      this.dispatchGameplayEvents(result.events);
      this.dispatchGameplayEvents(result.delayedEvents);
      this.triggerComAutoPlayAfterEvents(
        data.roomId,
        result.delayedEvents ?? [],
      );
    } catch (error) {
      console.error('Error in handlePassBlow:', error);
      client.emit('error-message', 'Failed to pass blow');
    }
  }

  @SubscribeMessage('select-negri')
  async handleSelectNegri(
    client: Socket,
    data: { roomId: string; card: string },
  ): Promise<void> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'select Negri')
    ) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'select Negri')) {
      return;
    }

    try {
      const actorId = this.getActorId(client);
      const result = await this.selectNegriUseCase.execute({
        roomId: data.roomId,
        actorId,
        card: data.card,
      });

      if (!result.success) {
        client.emit('error-message', result.error ?? 'Failed to select Negri');
        return;
      }

      this.dispatchGameplayEvents(result.events);
    } catch (error) {
      console.error('Error in handleSelectNegri:', error);
      client.emit('error-message', 'Failed to select Negri');
    }
  }

  @SubscribeMessage('request-agari')
  async handleRequestAgari(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RequestAgariPayload,
  ): Promise<void> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'request Agari')
    ) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'request Agari')) {
      return;
    }

    try {
      const roomGameState = await this.roomService.getRoomGameState(
        data.roomId,
      );
      const state = roomGameState.getState();
      const requesterSeatId = await this.resolveClientRoomSeatId(
        data.roomId,
        client,
      );
      const winningSeatId = state.blowState.currentHighestDeclaration?.seatId;

      if (
        state.gamePhase !== 'play' ||
        !state.agari ||
        !requesterSeatId ||
        requesterSeatId !== winningSeatId
      ) {
        return;
      }

      const payload: RevealAgariPayload = {
        agari: state.agari,
        message: 'Select a card from your hand as Negri',
        seatId: requesterSeatId,
      };
      client.emit('reveal-agari', payload);
    } catch (error) {
      this.logger.error('Error in handleRequestAgari:', error);
      client.emit('error-message', 'Failed to reveal Agari');
    }
  }

  @SubscribeMessage('play-card')
  async handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlayCardPayload,
  ): Promise<void> {
    this.activityTracker.recordActivity();

    if (
      this.spectatorGatewayEffectsService.rejectAction(client, 'play a card')
    ) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'play a card')) {
      return;
    }

    try {
      const actorId = this.getActorId(client);
      const result = await this.playCardUseCase.execute({
        roomId: data.roomId,
        actorId,
        card: data.card,
      });

      if (!result.success) {
        client.emit('error-message', result.error ?? 'Failed to play card');
        return;
      }

      this.dispatchGameplayEvents(result.events);

      if (result.completeFieldTrigger) {
        this.scheduleFieldCompletion(result.completeFieldTrigger);
      } else {
        this.triggerComAutoPlayIfNeeded(data.roomId);
      }
    } catch (error) {
      console.error('Error in handlePlayCard:', error);
      client.emit('error-message', 'Failed to play card');
    }
  }

  @SubscribeMessage('select-base-suit')
  async handleSelectBaseSuit(
    client: Socket,
    data: { roomId: string; suit: string },
  ): Promise<void> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(
        client,
        'select base suit',
      )
    ) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'select base suit')) {
      return;
    }

    try {
      const actorId = this.getActorId(client);
      const result = await this.selectBaseSuitUseCase.execute({
        roomId: data.roomId,
        actorId,
        suit: data.suit,
      });

      if (!result.success) {
        client.emit('error-message', result.error ?? 'Cannot select base suit');
        return;
      }

      this.dispatchGameplayEvents(result.events);
      this.triggerComAutoPlayIfNeeded(data.roomId);
    } catch (error) {
      console.error('Error in handleSelectBaseSuit:', error);
      client.emit('error-message', 'Failed to select base suit');
    }
  }

  @SubscribeMessage('reveal-broken-hand')
  async handleRevealBrokenHand(
    client: Socket,
    data: RevealBrokenHandPayload,
  ): Promise<void> {
    if (
      this.spectatorGatewayEffectsService.rejectAction(
        client,
        'reveal broken hand',
      )
    ) {
      return;
    }
    if (await this.rejectInactiveMutatingAction(client, 'reveal broken hand')) {
      return;
    }

    try {
      const actorId = this.getActorId(client);
      const seatId = await this.resolveClientRoomSeatId(data.roomId, client);
      const preparation = await this.revealBrokenHandUseCase.prepare({
        roomId: data.roomId,
        actorId,
        seatId,
      });

      if (!preparation.success || !preparation.followUp) {
        client.emit(
          'error-message',
          preparation.error ?? 'Failed to process broken hand',
        );
        return;
      }

      const delay = preparation.delayMs ?? 0;
      const followUp = preparation.followUp;
      this.finalizeBrokenHandAfterDelay(followUp, delay);
    } catch (error) {
      console.error('Error in handleRevealBrokenHand:', error);
      client.emit('error-message', 'Failed to process broken hand');
    }
  }

  //-------Auth Update-------
  @SubscribeMessage('update-auth')
  async handleUpdateAuth(
    client: Socket,
    data: { token?: string },
  ): Promise<void> {
    try {
      const result = await this.updateAuthUseCase.execute({
        socketId: client.id,
        token: data?.token,
        currentRoomId: this.playerRooms.get(client.id),
        handshakeName:
          typeof client.handshake.auth?.name === 'string'
            ? client.handshake.auth?.name
            : undefined,
      });

      if (!result.success || !result.authenticatedUser) {
        client.emit('error-message', result.error ?? 'Authentication failed');
        return;
      }

      (client.data as { user?: AuthenticatedUser }).user =
        result.authenticatedUser;

      this.dispatchEvents(result.broadcastEvents);
      this.dispatchEvents(result.roomEvents);
    } catch (error) {
      console.error('[GameGateway] Error in handleUpdateAuth:', error);
      client.emit('error-message', 'Internal server error');
    }
  }
}
