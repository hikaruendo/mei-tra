import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUpdateAuthUseCase,
  UpdateAuthRequest,
  UpdateAuthResponse,
} from './interfaces/update-auth.use-case.interface';
import { AuthService } from '../auth/auth.service';
import { IGameStateService } from '../services/interfaces/game-state-service.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { AuthenticatedUser } from '../types/user.types';
import {
  buildPlayerSyncEvents,
  buildRoomUpdatedEvent,
  resolvePlayerByActorId,
  resolvePlayerBySocketId,
} from './helpers/player-resolution.helper';

@Injectable()
export class UpdateAuthUseCase implements IUpdateAuthUseCase {
  private readonly logger = new Logger(UpdateAuthUseCase.name);

  constructor(
    private readonly authService: AuthService,
    @Inject('IGameStateService') private readonly gameState: IGameStateService,
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: UpdateAuthRequest): Promise<UpdateAuthResponse> {
    try {
      if (!request.token) {
        return { success: false, error: 'No token provided' };
      }

      const authenticatedUser = await this.authService.getUserFromSocketToken(
        request.token,
        { bypassCache: true },
      );

      if (!authenticatedUser) {
        return { success: false, error: 'Token validation failed' };
      }

      const { clientEvents, broadcastEvents } = this.ensureUserRegistered(
        request.socketId,
        authenticatedUser,
        request.handshakeName,
      );

      const roomEvents = await this.syncRoomPlayer(
        request.currentRoomId,
        request.socketId,
        authenticatedUser,
      );

      return {
        success: true,
        authenticatedUser,
        clientEvents,
        broadcastEvents,
        roomEvents,
      };
    } catch (error) {
      this.logger.error('Unexpected error in UpdateAuthUseCase', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  private ensureUserRegistered(
    socketId: string,
    authenticatedUser: AuthenticatedUser,
    handshakeName?: string,
  ): {
    clientEvents: GatewayEvent[];
    broadcastEvents: GatewayEvent[];
  } {
    const displayName =
      authenticatedUser.profile?.displayName ||
      authenticatedUser.email ||
      handshakeName ||
      'User';

    const clientEvents: GatewayEvent[] = [
      {
        scope: 'socket',
        socketId,
        event: 'auth-updated',
        payload: {
          userId: authenticatedUser.id,
          displayName,
          username: authenticatedUser.profile?.username,
        },
      },
    ];

    const syncResult = this.gameState.upsertSessionUser({
      socketId,
      playerId: authenticatedUser.id,
      name: displayName,
      userId: authenticatedUser.id,
      isAuthenticated: true,
    });

    if (syncResult.created || syncResult.changed) {
      return {
        clientEvents,
        broadcastEvents: [
          {
            scope: 'all',
            event: 'update-users',
            payload: this.gameState.getSessionUsers(),
          },
        ],
      };
    }

    return {
      clientEvents,
      broadcastEvents: [],
    };
  }

  private async syncRoomPlayer(
    currentRoomId: string | undefined,
    socketId: string,
    authenticatedUser: AuthenticatedUser,
  ): Promise<GatewayEvent[] | undefined> {
    if (!currentRoomId) {
      return undefined;
    }

    const roomGameState =
      await this.roomService.getRoomGameState(currentRoomId);
    const currentPlayer =
      resolvePlayerByActorId(roomGameState, authenticatedUser.id) ??
      resolvePlayerBySocketId(roomGameState, socketId);

    if (!currentPlayer) {
      return undefined;
    }

    const state = roomGameState.getState();
    const displayName =
      authenticatedUser.profile?.displayName ||
      authenticatedUser.email ||
      currentPlayer.name;
    currentPlayer.name = displayName;
    await roomGameState.applyPlayerConnectionState(currentPlayer.playerId, {
      socketId,
      userId: authenticatedUser.id,
      isAuthenticated: true,
    });

    await roomGameState.saveState();
    await this.roomService.updatePlayerInRoom(
      currentRoomId,
      currentPlayer.playerId,
      {
        socketId,
        name: displayName,
        userId: authenticatedUser.id,
        isAuthenticated: true,
      },
    );
    const updatedRoom = await this.roomService.getRoom(currentRoomId);

    const roomEvents: GatewayEvent[] = buildPlayerSyncEvents(
      roomGameState,
      currentRoomId,
      state.players,
      { room: updatedRoom },
    );

    if (updatedRoom) {
      roomEvents.push(
        buildRoomUpdatedEvent(roomGameState, updatedRoom, state.players),
      );
    }

    return roomEvents;
  }
}
