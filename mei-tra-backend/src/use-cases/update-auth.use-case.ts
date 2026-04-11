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

    const users = this.gameState.getUsers();
    const existingUser = users.find((user) => user.id === socketId);

    if (!existingUser) {
      const added = this.gameState.addPlayer(
        socketId,
        displayName,
        authenticatedUser.id,
        true,
      );

      if (added) {
        const updatedUsers = this.gameState.getUsers();
        return {
          clientEvents,
          broadcastEvents: [
            {
              scope: 'all',
              event: 'update-users',
              payload: updatedUsers,
            },
          ],
        };
      }
    }

    const currentUser =
      existingUser ??
      this.gameState.getUsers().find((user) => user.id === socketId);

    if (!currentUser) {
      return {
        clientEvents,
        broadcastEvents: [],
      };
    }

    const nameChanged = currentUser.name !== displayName;
    const authChanged =
      currentUser.userId !== authenticatedUser.id ||
      currentUser.isAuthenticated !== true;

    if (nameChanged) {
      this.gameState.updateUserName(socketId, displayName);
    }

    if (authChanged) {
      currentUser.userId = authenticatedUser.id;
      currentUser.isAuthenticated = true;
    }

    if (nameChanged || authChanged) {
      return {
        clientEvents,
        broadcastEvents: [
          {
            scope: 'all',
            event: 'update-users',
            payload: this.gameState.getUsers(),
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
    const state = roomGameState.getState();
    const currentPlayer = state.players.find(
      (player) => player.id === socketId,
    );

    if (!currentPlayer) {
      return undefined;
    }

    const displayName =
      authenticatedUser.profile?.displayName ||
      authenticatedUser.email ||
      currentPlayer.name;
    currentPlayer.name = displayName;
    currentPlayer.userId = authenticatedUser.id;
    currentPlayer.isAuthenticated = true;

    await roomGameState.saveState();
    await this.roomService.updatePlayerInRoom(
      currentRoomId,
      currentPlayer.playerId,
      {
        name: displayName,
        userId: authenticatedUser.id,
        isAuthenticated: true,
      },
    );
    const updatedRoom = await this.roomService.getRoom(currentRoomId);

    const roomEvents: GatewayEvent[] = [
      {
        scope: 'room',
        roomId: currentRoomId,
        event: 'update-players',
        payload: state.players,
      },
    ];

    if (updatedRoom) {
      roomEvents.push({
        scope: 'room',
        roomId: currentRoomId,
        event: 'room-updated',
        payload: updatedRoom,
      });
    }

    return roomEvents;
  }
}
