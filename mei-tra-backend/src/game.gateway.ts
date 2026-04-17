import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
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
import {
  IDeclareBlowUseCase,
  RevealBrokenRequest,
} from './use-cases/interfaces/declare-blow.use-case.interface';
import { IPassBlowUseCase } from './use-cases/interfaces/pass-blow.use-case.interface';
import { ISelectNegriUseCase } from './use-cases/interfaces/select-negri.use-case.interface';
import { IPlayCardUseCase } from './use-cases/interfaces/play-card.use-case.interface';
import { ISelectBaseSuitUseCase } from './use-cases/interfaces/select-base-suit.use-case.interface';
import { IRevealBrokenHandUseCase } from './use-cases/interfaces/reveal-broken-hand.use-case.interface';
import { ICompleteFieldUseCase } from './use-cases/interfaces/complete-field.use-case.interface';
import { IProcessGameOverUseCase } from './use-cases/interfaces/process-game-over.use-case.interface';
import { IUpdateAuthUseCase } from './use-cases/interfaces/update-auth.use-case.interface';
import { IComAutoPlayUseCase } from './use-cases/interfaces/com-autoplay-use-case.interface';
import { IActivityTrackerService } from './services/interfaces/activity-tracker-service.interface';
import { createSocketCorsOriginHandler } from './config/frontend-origins';
import { SessionUser } from './types/session.types';
import { JoinRoomGatewayEffectsService } from './services/join-room-gateway-effects.service';
import { DisconnectGatewayEffectsService } from './services/disconnect-gateway-effects.service';
import { RoomUpdateGatewayEffectsService } from './services/room-update-gateway-effects.service';
import { StartGameGatewayEffectsService } from './services/start-game-gateway-effects.service';
import { TurnMonitorService } from './services/turn-monitor.service';
import { ReconnectionUseCase } from './use-cases/reconnection.use-case';
import { ModeratePlayerUseCase } from './use-cases/moderate-player.use-case';
import { ShuffleTeamsUseCase } from './use-cases/shuffle-teams.use-case';
import { Room } from './types/room.types';
import { toRoomContract, toRoomContracts } from './types/room-adapters';

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
    @Inject('ICompleteFieldUseCase')
    private readonly completeFieldUseCase: ICompleteFieldUseCase,
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
    @Inject('IComAutoPlayUseCase')
    private readonly comAutoPlayUseCase: IComAutoPlayUseCase,
    @Inject('IActivityTrackerService')
    private readonly activityTracker: IActivityTrackerService,
    private readonly turnMonitorService: TurnMonitorService,
    private readonly reconnectionUseCase: ReconnectionUseCase,
    private readonly moderatePlayerUseCase: ModeratePlayerUseCase,
    private readonly shuffleTeamsUseCase: ShuffleTeamsUseCase,
    private readonly joinRoomGatewayEffectsService: JoinRoomGatewayEffectsService,
    private readonly disconnectGatewayEffectsService: DisconnectGatewayEffectsService,
    private readonly roomUpdateGatewayEffectsService: RoomUpdateGatewayEffectsService,
    private readonly startGameGatewayEffectsService: StartGameGatewayEffectsService,
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

  private normalizeGatewayPayload(event: GatewayEvent): unknown {
    if (event.event === 'room-updated' && event.payload) {
      return toRoomContract(event.payload as Room);
    }

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
                void this.startTurnAckMonitor(event.roomId, event.payload);
              }
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
        setTimeout(emit, event.delayMs);
      } else {
        emit();
      }
    });
  }

  private clearTurnAckMonitor(roomId: string): void {
    this.turnMonitorService.clearMonitor(roomId);
  }

  private async forceReplacePlayerWithCOM(
    roomId: string,
    playerId: string,
    message: string,
  ): Promise<boolean> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const room = await this.roomService.getRoom(roomId);
    const targetPlayer = room?.players.find(
      (player) => player.playerId === playerId,
    );
    const targetSocketId =
      roomGameState.getPlayerConnectionState(playerId)?.socketId;
    const targetSocket = targetSocketId
      ? this.server.sockets.sockets.get(targetSocketId)
      : undefined;

    if (targetSocket) {
      await targetSocket.leave(roomId);
      this.playerRooms.delete(targetSocket.id);
      targetSocket.emit('error-message', message);
      targetSocket.emit('back-to-lobby');
    }

    const converted = await this.roomService.convertPlayerToCOM(
      roomId,
      playerId,
    );
    if (!converted) {
      return false;
    }

    const updatedRoom = await this.roomService.getRoom(roomId);
    this.server.to(roomId).emit('player-converted-to-com', {
      playerId,
      playerName: targetPlayer?.name ?? playerId,
      message,
    });
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
    playerId: string,
  ): Promise<void> {
    await this.turnMonitorService.startMonitor(
      roomId,
      playerId,
      this.server,
      async (monitoredRoomId, monitoredPlayerId) => {
        await this.forceReplacePlayerWithCOM(
          monitoredRoomId,
          monitoredPlayerId,
          'Player became unresponsive during their turn - converted to COM',
        );
      },
    );
  }

  private isPlayerIdle(roomId: string, playerId: string): boolean {
    return this.turnMonitorService.isPlayerIdle(roomId, playerId);
  }

  private async triggerRevealBrokenHand(request?: RevealBrokenRequest) {
    if (!request) {
      return;
    }

    const roomGameState = await this.roomService.getRoomGameState(
      request.roomId,
    );
    const sessionUser =
      roomGameState.findSessionUserByUserId(request.actorId) ??
      roomGameState.findSessionUserBySocketId(request.actorId) ??
      roomGameState.findSessionUserByPlayerId(request.actorId);
    const clientSocket = sessionUser?.socketId
      ? this.server.sockets.sockets.get(sessionUser.socketId)
      : undefined;
    if (!clientSocket) {
      console.warn(
        '[GameGateway] Socket not found when handling required broken hand',
        request,
      );
      return;
    }

    try {
      await this.handleRevealBrokenHand(clientSocket, {
        roomId: request.roomId,
        playerId: request.playerId,
      });
    } catch (error) {
      console.error('Failed to trigger reveal-broken-hand flow:', error);
    }
  }

  private async processFieldCompletionResult(
    roomId: string,
    response: Awaited<ReturnType<ICompleteFieldUseCase['execute']>>,
  ) {
    if (!response.success) {
      this.server
        .to(roomId)
        .emit('error-message', response.error ?? 'Failed to complete field');
      return;
    }

    this.dispatchEvents(response.events);
    this.dispatchEvents(response.delayedEvents);

    const delayedEvents = response.delayedEvents ?? [];
    const maxDelay = delayedEvents.reduce(
      (max, event) => Math.max(max, event.delayMs ?? 0),
      0,
    );

    const scheduleAutoPlay = () => this.triggerComAutoPlayIfNeeded(roomId);

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
    } else if (maxDelay > 0) {
      setTimeout(scheduleAutoPlay, maxDelay + 100);
    } else {
      scheduleAutoPlay();
    }
  }

  private async closeFinishedRoom(roomId: string): Promise<void> {
    try {
      this.clearTurnAckMonitor(roomId);

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

      await this.roomService.releaseRoomResources(roomId);
      const roomsList = await this.roomService.listRooms();
      this.emitRoomsListToAll(roomsList);
    } catch (error) {
      console.error('Failed to close finished room:', error);
    }
  }

  private async sendBackToLobby(
    client: Socket,
    reason: string,
    roomId?: string,
  ): Promise<void> {
    console.warn(
      `[Reconnection] Sending back-to-lobby for socket=${client.id} room=${roomId ?? 'none'} reason=${reason}`,
    );
    if (roomId) {
      await client.leave(roomId);
    }
    this.playerRooms.delete(client.id);
    client.emit('back-to-lobby');
    client.emit('error-message', reason);
    this.emitRoomsListToSocket(client, await this.roomService.listRooms());
  }

  private triggerComAutoPlayIfNeeded(roomId: string): void {
    // Non-blocking: fire and forget
    void this.runComAutoPlayLoop(roomId);
  }

  private async runComAutoPlayLoop(roomId: string): Promise<void> {
    let iteration = 0;
    const MAX_ITERATIONS = 10; // Safety limit: max 10 consecutive COM plays

    while (iteration < MAX_ITERATIONS) {
      const result = await this.comAutoPlayUseCase.execute({ roomId });

      if (!result.success) {
        console.error(`COM auto-play failed: ${result.error}`);
        return;
      }

      // イベント配信（遅延含む）
      this.dispatchEvents(result.events);
      this.dispatchEvents(result.delayedEvents);
      await this.triggerRevealBrokenHand(result.revealBrokenRequest);

      if (result.completeFieldTrigger) {
        const trigger = result.completeFieldTrigger;
        setTimeout(() => {
          void this.completeFieldUseCase
            .execute({ roomId: trigger.roomId, field: trigger.field })
            .then((response) =>
              this.processFieldCompletionResult(trigger.roomId, response),
            )
            .catch((error) => {
              console.error('Error completing field:', error);
              this.server
                .to(trigger.roomId)
                .emit('error-message', 'Failed to complete field');
            });
        }, trigger.delayMs);
        return; // Wait for completion result before continuing loop
      }

      if (!result.shouldContinue) {
        return; // Stop the loop - no more COM players
      }

      iteration++;

      // Non-blocking wait - yields to event loop
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Safety: log if we hit the iteration limit
    console.error(
      `[GameGateway] COM auto-play loop exceeded ${MAX_ITERATIONS} iterations for room ${roomId}. Possible infinite loop prevented.`,
    );
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
      const result = await this.reconnectionUseCase.execute({
        roomId,
        socketId: client.id,
        authenticatedUser,
      });

      if (!result.success) {
        await this.sendBackToLobby(client, result.reason, roomId);
        return;
      }

      this.playerRooms.set(client.id, roomId);
      await client.join(roomId);

      if (result.mode === 'waiting-room') {
        const reconnectEntryEvents =
          await this.joinRoomGatewayEffectsService.buildRoomEntryEvents({
            clientId: client.id,
            room: result.room,
            selfPlayer: {
              playerId: result.selfPlayerId,
              name: result.selfName,
              team: result.selfTeam,
            },
            isHost: result.isHost,
            roomStatus: result.room.status,
            roomsList: result.roomsList,
            roomsListScope: 'socket',
          });
        this.dispatchEvents(reconnectEntryEvents);
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
      if (result.currentTurnPlayerId) {
        void this.startTurnAckMonitor(roomId, result.currentTurnPlayerId);
      }
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
      playerId: userId,
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

  @SubscribeMessage('update-name')
  handleUpdateName(@ConnectedSocket() client: Socket) {
    // Name updates not supported for authenticated users
    // Display name comes from profile
    client.emit('name-updated', {
      success: false,
      error: 'Name updates not supported. Please update your profile.',
    });
  }

  async handleDisconnect(client: Socket) {
    this.activityTracker.decrementConnections();

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
        this.turnMonitorService.isMonitoringPlayer(roomId, preparation.playerId)
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
            playerId: preparation.playerId,
            playerName: preparation.playerName,
            timeoutMode: preparation.timeoutMode,
          })
          .then((events) => this.dispatchEvents(events))
          .catch((error) => {
            console.error(
              '[Disconnect] Error processing disconnect timeout:',
              error,
            );
          });
      }, timeoutMs);

      preparation.roomGameState.setDisconnectTimeout(
        preparation.playerId,
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
        authenticatedUser,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.errorMessage || 'Failed to create room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const { room: updatedRoom, hostPlayer, roomsList } = result.data;
      this.playerRooms.set(client.id, updatedRoom.id);
      await client.join(updatedRoom.id);
      const createRoomEvents =
        await this.joinRoomGatewayEffectsService.buildRoomEntryEvents({
          clientId: client.id,
          room: updatedRoom,
          selfPlayer: {
            playerId: hostPlayer.playerId,
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
    @MessageBody() data: { roomId: string; user: SessionUser },
  ) {
    this.activityTracker.recordActivity();

    try {
      const currentRoomId = this.playerRooms.get(client.id);
      const authenticatedUser = this.getAuthenticatedUser(client);

      const result = await this.joinRoomUseCase.execute({
        socketId: client.id,
        targetRoomId: data.roomId,
        currentRoomId,
        user: data.user,
        authenticatedUser,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.errorMessage ?? 'Failed to join room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const normalizedUser = result.normalizedUser ?? data.user;

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
    @MessageBody() data: { roomId: string; playerId: string },
  ) {
    try {
      const result = await this.togglePlayerReadyUseCase.execute({
        roomId: data.roomId,
        playerId: data.playerId,
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
    @MessageBody() data: { roomId: string; playerId: string },
  ) {
    try {
      const result = await this.leaveRoomUseCase.execute({
        playerId: data.playerId,
        roomId: data.roomId,
      });

      if (!result.success || !result.data) {
        const errorMessage = result.errorMessage || 'Failed to leave room';
        client.emit('error-message', errorMessage);
        return { success: false, error: errorMessage };
      }

      const {
        playerId,
        roomDeleted,
        roomsList,
        updatedPlayers,
        gamePausedMessage,
      } = result.data;

      await client.leave(data.roomId);
      this.playerRooms.delete(client.id);

      if (roomDeleted) {
        this.server.to(client.id).emit('back-to-lobby');
        this.emitRoomsListToAll(roomsList);
        return { success: true };
      }

      this.server.to(data.roomId).emit('player-left', {
        playerId,
        roomId: data.roomId,
      });

      this.emitRoomsListToAll(roomsList);
      this.server.to(client.id).emit('back-to-lobby');

      if (updatedPlayers) {
        this.dispatchEvents([
          this.roomUpdateGatewayEffectsService.buildPlayersEvent({
            players: updatedPlayers,
            scope: 'room',
            roomId: data.roomId,
          }),
        ]);
      }

      if (gamePausedMessage) {
        this.server
          .to(data.roomId)
          .emit('game-paused', { message: gamePausedMessage });
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
    data: {
      roomId: string;
      requesterPlayerId: string;
      targetPlayerId: string;
      action: 'remove' | 'replace-with-com';
    },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.moderatePlayerUseCase.execute({
        roomId: data.roomId,
        requesterPlayerId: data.requesterPlayerId,
        targetPlayerId: data.targetPlayerId,
        action: data.action,
        isPlayerIdle: this.isPlayerIdle(data.roomId, data.targetPlayerId),
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
          playerId: result.playerId,
          roomId: data.roomId,
        });
        this.emitRoomsListToAll(result.roomsList);
        return { success: true };
      }

      this.clearTurnAckMonitor(data.roomId);
      this.server.to(data.roomId).emit('player-converted-to-com', {
        playerId: result.playerId,
        playerName: result.playerName,
        message: result.message,
      });
      this.dispatchEvents(
        await this.roomUpdateGatewayEffectsService.buildRoomEvents({
          room: result.updatedRoom,
          scope: 'room',
          roomId: data.roomId,
        }),
      );
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
    const roomId = data.roomId || this.playerRooms.get(client.id);
    if (!roomId) {
      return;
    }
    await this.turnMonitorService.acknowledge(
      roomId,
      client.id,
      this.getAuthenticatedUser(client)?.id,
    );
  }

  @SubscribeMessage('change-player-team')
  async handleChangePlayerTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      playerId: string;
      teamChanges: { [key: string]: number };
    },
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.changePlayerTeamUseCase.execute({
        roomId: data.roomId,
        playerId: data.playerId,
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
    @MessageBody() data: { roomId: string; playerId: string },
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.shuffleTeamsUseCase.execute({
        roomId: data.roomId,
        playerId: data.playerId,
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

  @SubscribeMessage('fill-with-com')
  async handleFillWithCom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string },
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.fillWithComUseCase.execute({
        roomId: data.roomId,
        playerId: data.playerId,
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
  async handleStartGame(
    client: Socket,
    data: { roomId: string; playerId: string },
  ) {
    this.activityTracker.recordActivity();

    const result = await this.startGameUseCase.execute({
      playerId: data.playerId,
      roomId: data.roomId,
    });

    if (!result.success || !result.data) {
      const errorMessage = result.errorMessage || 'Failed to start game';
      client.emit('error-message', errorMessage);
      return { success: false, error: errorMessage };
    }

    const { players, pointsToWin, updatePhase, currentTurnPlayerId } =
      result.data;
    const startGameEvents =
      await this.startGameGatewayEffectsService.buildEvents({
        roomId: data.roomId,
        players,
        pointsToWin,
        updatePhase,
        currentTurnPlayerId,
      });

    this.dispatchEvents(startGameEvents);

    this.triggerComAutoPlayIfNeeded(data.roomId);

    return { success: true };
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

      this.dispatchEvents(result.events);
      this.dispatchEvents(result.delayedEvents);
      await this.triggerRevealBrokenHand(result.revealBrokenRequest);
      this.triggerComAutoPlayIfNeeded(data.roomId);
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

      this.dispatchEvents(result.events);
      this.dispatchEvents(result.delayedEvents);
      await this.triggerRevealBrokenHand(result.revealBrokenRequest);
      this.triggerComAutoPlayIfNeeded(data.roomId);
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

      this.dispatchEvents(result.events);
    } catch (error) {
      console.error('Error in handleSelectNegri:', error);
      client.emit('error-message', 'Failed to select Negri');
    }
  }

  @SubscribeMessage('play-card')
  async handlePlayCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; card: string },
  ): Promise<void> {
    this.activityTracker.recordActivity();

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

      this.dispatchEvents(result.events);

      if (result.completeFieldTrigger) {
        const trigger = result.completeFieldTrigger;
        setTimeout(() => {
          void this.completeFieldUseCase
            .execute({
              roomId: trigger.roomId,
              field: trigger.field,
            })
            .then((response) =>
              this.processFieldCompletionResult(trigger.roomId, response),
            )
            .catch((error) => {
              console.error('Error completing field:', error);
              this.server
                .to(trigger.roomId)
                .emit('error-message', 'Failed to complete field');
            });
        }, trigger.delayMs);
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

      this.dispatchEvents(result.events);
      this.triggerComAutoPlayIfNeeded(data.roomId);
    } catch (error) {
      console.error('Error in handleSelectBaseSuit:', error);
      client.emit('error-message', 'Failed to select base suit');
    }
  }

  @SubscribeMessage('reveal-broken-hand')
  async handleRevealBrokenHand(
    client: Socket,
    data: { roomId: string; playerId: string },
  ): Promise<void> {
    try {
      const actorId = this.getActorId(client);
      const preparation = await this.revealBrokenHandUseCase.prepare({
        roomId: data.roomId,
        actorId,
        playerId: data.playerId,
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

            this.dispatchEvents(completion.events);
            this.triggerComAutoPlayIfNeeded(data.roomId);
          })
          .catch((error) =>
            console.error('Error finalizing broken hand sequence:', error),
          );
      }, delay);
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
        client.emit(
          'auth-update-error',
          result.error ?? 'Authentication failed',
        );
        return;
      }

      (client.data as { user?: AuthenticatedUser }).user =
        result.authenticatedUser;

      this.dispatchEvents(result.clientEvents);
      this.dispatchEvents(result.broadcastEvents);
      this.dispatchEvents(result.roomEvents);
    } catch (error) {
      console.error('[GameGateway] Error in handleUpdateAuth:', error);
      client.emit('auth-update-error', 'Internal server error');
    }
  }
}
