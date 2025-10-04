import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { IGameStateService } from './services/interfaces/game-state-service.interface';
import { ICardService } from './services/interfaces/card-service.interface';
import { IScoreService } from './services/interfaces/score-service.interface';
import { IBlowService } from './services/interfaces/blow-service.interface';
import { IPlayService } from './services/interfaces/play-service.interface';
import { IRoomService } from './services/interfaces/room-service.interface';
import { IChomboService } from './services/interfaces/chombo-service.interface';
import { TrumpType, User } from './types/game.types';
import { RoomStatus } from './types/room.types';
import { ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { AuthService } from './auth/auth.service';
import { AuthenticatedUser } from './types/user.types';
import { IJoinRoomUseCase } from './use-cases/interfaces/join-room.use-case.interface';
import { ICreateRoomUseCase } from './use-cases/interfaces/create-room.use-case.interface';
import { ILeaveRoomUseCase } from './use-cases/interfaces/leave-room.use-case.interface';
import { IStartGameUseCase } from './use-cases/interfaces/start-game.use-case.interface';
import { ITogglePlayerReadyUseCase } from './use-cases/interfaces/toggle-player-ready.use-case.interface';
import { IChangePlayerTeamUseCase } from './use-cases/interfaces/change-player-team.use-case.interface';
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

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private playerRooms: Map<string, string> = new Map(); // socketId -> roomId

  constructor(
    @Inject('IGameStateService')
    private readonly gameState: IGameStateService,
    @Inject('ICardService')
    private readonly cardService: ICardService,
    @Inject('IScoreService')
    private readonly scoreService: IScoreService,
    @Inject('IBlowService')
    private readonly blowService: IBlowService,
    @Inject('IPlayService')
    private readonly playService: IPlayService,
    @Inject('IChomboService')
    private readonly chomboService: IChomboService,
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
    private readonly authService: AuthService,
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

  private dispatchEvents(events?: GatewayEvent[]) {
    if (!events) {
      return;
    }

    events.forEach((event) => {
      const emit = () => {
        switch (event.scope) {
          case 'room':
            if (event.roomId) {
              this.server.to(event.roomId).emit(event.event, event.payload);
            }
            break;
          case 'socket':
            if (event.socketId) {
              this.server.to(event.socketId).emit(event.event, event.payload);
            }
            break;
          case 'all':
            this.server.emit(event.event, event.payload);
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

  private async triggerRevealBrokenHand(request?: RevealBrokenRequest) {
    if (!request) {
      return;
    }

    const clientSocket = this.server.sockets.sockets.get(request.socketId);
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

    if (response.gameOver) {
      await this.processGameOverUseCase.execute({
        roomId,
        players: response.gameOver.players,
        winningTeam: response.gameOver.winningTeam,
        teamScores: response.gameOver.teamScores,
        resetDelayMs: response.gameOver.resetDelayMs,
      });
    }
  }

  //-------Connection-------
  async handleConnection(client: Socket) {
    const auth = client.handshake.auth || {};
    const reconnectToken =
      typeof auth.reconnectToken === 'string' ? auth.reconnectToken : undefined;
    const name = typeof auth.name === 'string' ? auth.name : undefined;
    const roomId = typeof auth.roomId === 'string' ? auth.roomId : undefined;
    const supabaseToken =
      typeof auth.token === 'string' ? auth.token : undefined;

    // Try to authenticate with Supabase token
    let authenticatedUser: AuthenticatedUser | null = null;
    if (supabaseToken) {
      try {
        authenticatedUser =
          await this.authService.getUserFromSocketToken(supabaseToken);
        if (authenticatedUser) {
          // Store authenticated user in socket data
          (client.data as { user: AuthenticatedUser }).user = authenticatedUser;
        }
      } catch (error) {
        console.warn(
          '[Auth] Failed to authenticate user with Supabase token:',
          error,
        );
      }
    }

    // 再接続処理（優先順位: userId > reconnectToken）
    if (roomId) {
      try {
        // ルームのゲーム状態を取得
        const roomGameState = await this.roomService.getRoomGameState(roomId);

        let existingPlayer: Awaited<
          ReturnType<typeof roomGameState.findPlayerByUserId>
        > = null;

        // 優先度1: ログインユーザーはuserIdで検索
        if (authenticatedUser?.id) {
          existingPlayer = roomGameState.findPlayerByUserId(
            authenticatedUser.id,
          );
          if (existingPlayer) {
            console.log(
              `[Reconnection] Found player by userId: ${authenticatedUser.id}`,
            );
          }
        }

        // 優先度2: reconnectTokenで検索（ゲストユーザー用）
        if (!existingPlayer && reconnectToken) {
          existingPlayer =
            roomGameState.findPlayerByReconnectToken(reconnectToken);
          if (existingPlayer) {
            console.log(
              `[Reconnection] Found player by reconnectToken: ${reconnectToken}`,
            );
          }

          // Try to restore from vacant seat if not found
          if (!existingPlayer) {
            const restored = await this.roomService.restorePlayerFromVacantSeat(
              roomId,
              reconnectToken,
            );
            if (restored) {
              existingPlayer =
                roomGameState.findPlayerByReconnectToken(reconnectToken);
            }
          }
        }

        if (existingPlayer) {
          // ルームサービスで再接続処理
          void this.roomService
            .handlePlayerReconnection(
              roomId,
              existingPlayer.playerId,
              client.id,
            )
            .then((result) => {
              if (!result.success) {
                client.emit('error-message', 'Failed to reconnect');
                client.disconnect();
                return;
              }

              // ルームに参加
              this.playerRooms.set(client.id, roomId);
              void client.join(roomId);

              const state = roomGameState.getState();

              // ゲーム状態をクライアントに送信
              this.server.to(client.id).emit('game-state', {
                players: state.players.map((player) => ({
                  ...player,
                  hand:
                    player.playerId === existingPlayer.playerId
                      ? player.hand
                      : [], // 自分の手札のみ表示
                })),
                gamePhase: state.gamePhase || 'waiting',
                currentField: state.playState?.currentField,
                currentTurn:
                  state.currentPlayerIndex !== -1 &&
                  state.players[state.currentPlayerIndex]
                    ? state.players[state.currentPlayerIndex].playerId
                    : null,
                blowState: state.blowState,
                teamScores: state.teamScores,
                you: existingPlayer.playerId,
                negriCard: state.playState?.negriCard,
                fields: state.playState?.fields,
                roomId: roomId,
                pointsToWin: state.pointsToWin,
              });
              this.server.to(roomId).emit('update-players', state.players);

              // Issue reconnect token only for guest users
              // Authenticated users don't need it (they use userId)
              if (!authenticatedUser) {
                this.server
                  .to(client.id)
                  .emit('reconnect-token', `${existingPlayer.playerId}`);
                console.log(
                  `[Reconnection] Issued new token for guest player: ${existingPlayer.playerId}`,
                );
              } else {
                console.log(
                  `[Reconnection] Skipped token for authenticated user: ${authenticatedUser.id}`,
                );
              }
            });
        } else {
          // プレイヤーが見つからない場合、トークンが無効または期限切れ
          client.emit('error-message', 'Reconnection token expired or invalid');
          client.disconnect();
        }
      } catch (error) {
        console.error('Error in handlePlayerReconnection:', error);
        client.emit('error-message', 'Game state not found');
        client.disconnect();
      }
      return;
    }

    // 新規プレイヤーとして追加
    // 認証済みユーザーまたは名前がある場合に処理
    if (name || authenticatedUser) {
      // Determine display name and player ID
      const displayName =
        authenticatedUser?.profile?.displayName ||
        authenticatedUser?.email ||
        name ||
        'User';
      const userId = authenticatedUser?.id;

      if (
        this.gameState.addPlayer(
          client.id,
          displayName,
          reconnectToken,
          userId,
          !!authenticatedUser,
        )
      ) {
        const users = this.gameState.getUsers();
        const newUser = users.find((p) => p.id === client.id);

        if (newUser) {
          // Issue reconnect token only for guest users
          if (!authenticatedUser) {
            this.server
              .to(client.id)
              .emit('reconnect-token', `${newUser.playerId}`);
          }
          this.server.emit('update-users', users);
        }
      } else {
        client.emit('error-message', 'Game is full!');
        client.disconnect();
      }
    } else {
      // Allow connection to remain open without immediate name/reconnectToken.
      // The client can later authenticate via 'update-auth' or join with a name.
    }
  }

  @SubscribeMessage('update-name')
  handleUpdateName(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name?: string },
  ) {
    const trimmedName = data?.name?.trim();
    if (!trimmedName) {
      client.emit('name-updated', {
        success: false,
        error: 'Name is required',
      });
      client.emit('error-message', 'Name is required');
      return;
    }

    // Persist name on the handshake auth for debugging/reconnection attempts
    try {
      (client.handshake.auth as Record<string, unknown>).name = trimmedName;
    } catch {
      // No-op if auth object is frozen
    }

    const existingUser = this.gameState
      .getUsers()
      .find((user) => user.id === client.id);

    if (existingUser) {
      this.gameState.updateUserName(client.id, trimmedName);
      existingUser.name = trimmedName;
      this.server.emit('update-users', this.gameState.getUsers());
      client.emit('name-updated', {
        success: true,
        playerId: existingUser.playerId,
        name: trimmedName,
      });
      return;
    }

    const handshakeAuth = client.handshake.auth || {};
    const reconnectToken =
      typeof handshakeAuth.reconnectToken === 'string'
        ? handshakeAuth.reconnectToken
        : undefined;

    const authenticatedUser = (client.data as { user?: AuthenticatedUser })
      .user;

    if (
      this.gameState.addPlayer(
        client.id,
        trimmedName,
        reconnectToken,
        authenticatedUser?.id,
        !!authenticatedUser,
      )
    ) {
      const users = this.gameState.getUsers();
      const newUser = users.find((user) => user.id === client.id);
      if (newUser) {
        this.server.emit('update-users', users);
        // Issue reconnect token only for guest users
        if (!authenticatedUser) {
          this.server
            .to(client.id)
            .emit('reconnect-token', `${newUser.playerId}`);
        }
        client.emit('name-updated', {
          success: true,
          playerId: newUser.playerId,
          name: newUser.name,
        });
        return;
      }
    }

    client.emit('name-updated', {
      success: false,
      error: 'Unable to register name',
    });
    client.emit('error-message', 'Unable to register name');
  }

  async handleDisconnect(client: Socket) {
    const roomId = this.playerRooms.get(client.id);
    if (roomId) {
      this.playerRooms.delete(client.id);
      await client.leave(roomId);

      // Get room-specific game state
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.id === client.id);

      if (player) {
        // プレイヤーのチーム情報を保持
        state.teamAssignments[player.playerId] = player.team;

        // ソケットIDをクリア（切断状態を示す）
        player.id = '';

        // Notify other players in the same room about the disconnection
        this.server.to(roomId).emit('player-left', {
          playerId: player.playerId,
          roomId,
        });

        // プレイ中の場合は長めのタイムアウト(5分)を設定
        // プレイヤーとトークンを保持しつつ、長時間放置されたらダミーに変換
        if (state.gamePhase === 'play' || state.gamePhase === 'blow') {
          const timeout: NodeJS.Timeout = setTimeout(
            () => {
              void (async () => {
                try {
                  const room = await this.roomService.getRoom(roomId);
                  if (room?.status === RoomStatus.PLAYING) {
                    const converted: boolean =
                      await this.roomService.convertPlayerToDummy(
                        roomId,
                        player.playerId,
                      );
                    if (converted) {
                      this.server.to(roomId).emit('player-converted-to-dummy', {
                        playerId: player.playerId,
                        message:
                          'Player disconnected for too long - converted to dummy',
                      });
                      this.server
                        .to(roomId)
                        .emit(
                          'update-players',
                          roomGameState.getState().players,
                        );
                    }
                  }
                } catch (error) {
                  console.error(
                    '[Disconnect] Error converting player to dummy:',
                    error,
                  );
                }
              })();
            },
            5 * 60 * 1000,
          ); // 5 minutes

          roomGameState.setDisconnectTimeout(player.playerId, timeout);
        } else {
          // ロビー状態の場合のみタイムアウトを設定
          const timeout: NodeJS.Timeout = setTimeout(() => {
            roomGameState.removePlayer(player.playerId);
            this.server
              .to(roomId)
              .emit('update-players', roomGameState.getState().players);
          }, 10000); // 10 seconds timeout

          // Store the timeout ID for potential cancellation on reconnection
          roomGameState.setDisconnectTimeout(player.playerId, timeout);
        }
      }
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
    try {
      const auth = client.handshake.auth || {};

      // 認証済みユーザー情報を取得
      const authenticatedUser = (client.data as { user?: AuthenticatedUser })
        .user;

      // 共通ヘルパーメソッドを使用して名前を取得
      const playerName = this.getPlayerName(authenticatedUser || null, auth);
      const result = await this.createRoomUseCase.execute({
        clientId: client.id,
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

      const { room, roomsList } = result.data;

      this.playerRooms.set(client.id, room.id);
      await client.join(room.id);

      this.server.emit('rooms-list', roomsList);

      return { success: true, room };
    } catch (error) {
      console.error('Error in handleCreateRoom:', error);
      client.emit('error-message', 'Failed to create room');
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; user: User },
  ) {
    try {
      const currentRoomId = this.playerRooms.get(client.id);
      const authenticatedUser = (client.data as { user?: AuthenticatedUser })
        .user;

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
        this.server.to(currentRoomId).emit('player-left', {
          playerId:
            result.previousRoomNotification?.playerId ??
            normalizedUser.playerId,
          roomId: currentRoomId,
        });
      }

      this.playerRooms.set(client.id, data.roomId);
      await client.join(data.roomId);

      const { room, isHost, roomStatus, roomsList, resumeGame } = result.data;

      this.server.to(data.roomId).emit('room-player-joined', {
        playerId: normalizedUser.playerId,
        roomId: data.roomId,
        isHost,
      });

      this.server.to(data.roomId).emit('game-player-joined', {
        playerId: normalizedUser.playerId,
        roomId: data.roomId,
        isHost,
        roomStatus,
      });

      this.server.emit('rooms-list', roomsList);
      this.server.to(data.roomId).emit('set-room-id', data.roomId);

      if (resumeGame) {
        this.server.to(data.roomId).emit('game-resumed', {
          message: resumeGame.message,
        });
        this.server.to(data.roomId).emit('game-state', resumeGame.gameState);
      }

      return { success: true, room };
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
      client.emit('rooms-list', rooms);
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

      this.server.to(data.roomId).emit('room-updated', result.updatedRoom);
      return { success: true };
    } catch (error) {
      console.error('Error in handleTogglePlayerReady:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      const result = await this.leaveRoomUseCase.execute({
        clientId: client.id,
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
        this.server.emit('rooms-list', roomsList);
        return { success: true };
      }

      this.server.to(data.roomId).emit('player-left', {
        playerId,
        roomId: data.roomId,
      });

      this.server.emit('rooms-list', roomsList);
      this.server.to(client.id).emit('back-to-lobby');

      if (updatedPlayers) {
        this.server.to(data.roomId).emit('update-players', updatedPlayers);
      }

      if (gamePausedMessage) {
        this.server
          .to(data.roomId)
          .emit('game-paused', { message: gamePausedMessage });
      }

      return { success: true };
    } catch (error) {
      console.error('Error in handleLeaveRoom:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  @SubscribeMessage('change-player-team')
  async handleChangePlayerTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; teamChanges: { [key: string]: number } },
  ): Promise<{ success: boolean }> {
    try {
      const result = await this.changePlayerTeamUseCase.execute({
        roomId: data.roomId,
        teamChanges: data.teamChanges,
      });

      if (!result.success || !result.updatedRoom) {
        const error = result.error || 'Failed to change teams';
        client.emit('error-message', error);
        return { success: false };
      }

      this.server.to(data.roomId).emit('room-updated', result.updatedRoom);
      return { success: true };
    } catch (error) {
      console.error('Error in handleChangePlayerTeam:', error);
      client.emit('error-message', 'Internal server error');
      return { success: false };
    }
  }
  //-------Room-------

  //-------Game-------
  @SubscribeMessage('start-game')
  async handleStartGame(client: Socket, data: { roomId: string }) {
    const result = await this.startGameUseCase.execute({
      clientId: client.id,
      roomId: data.roomId,
    });

    if (!result.success || !result.data) {
      const errorMessage = result.errorMessage || 'Failed to start game';
      client.emit('error-message', errorMessage);
      return { success: false, error: errorMessage };
    }

    const { players, pointsToWin, updatePhase, currentTurnPlayerId } =
      result.data;

    this.server.to(data.roomId).emit('room-playing', players);
    this.server
      .to(data.roomId)
      .emit('game-started', data.roomId, players, pointsToWin);
    this.server.to(data.roomId).emit('update-phase', updatePhase);
    this.server.to(data.roomId).emit('update-turn', currentTurnPlayerId);

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
    try {
      const result = await this.declareBlowUseCase.execute({
        roomId: data.roomId,
        socketId: client.id,
        declaration: data.declaration,
      });

      if (!result.success) {
        client.emit('error-message', result.error ?? 'Failed to declare blow');
        return;
      }

      this.dispatchEvents(result.events);
      this.dispatchEvents(result.delayedEvents);
      await this.triggerRevealBrokenHand(result.revealBrokenRequest);
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
    try {
      const result = await this.passBlowUseCase.execute({
        roomId: data.roomId,
        socketId: client.id,
      });

      if (!result.success) {
        client.emit('error-message', result.error ?? 'Failed to pass blow');
        return;
      }

      this.dispatchEvents(result.events);
      this.dispatchEvents(result.delayedEvents);
      await this.triggerRevealBrokenHand(result.revealBrokenRequest);
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
      const result = await this.selectNegriUseCase.execute({
        roomId: data.roomId,
        socketId: client.id,
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
    try {
      const result = await this.playCardUseCase.execute({
        roomId: data.roomId,
        socketId: client.id,
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
      const result = await this.selectBaseSuitUseCase.execute({
        roomId: data.roomId,
        socketId: client.id,
        suit: data.suit,
      });

      if (!result.success) {
        client.emit('error-message', result.error ?? 'Cannot select base suit');
        return;
      }

      this.dispatchEvents(result.events);
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
      const preparation = await this.revealBrokenHandUseCase.prepare({
        roomId: data.roomId,
        socketId: client.id,
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
