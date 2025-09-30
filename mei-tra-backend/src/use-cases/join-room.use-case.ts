import { Injectable, Logger, Inject } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  IJoinRoomUseCase,
  JoinRoomRequest,
  JoinRoomResponse,
  JoinRoomSuccess,
  ResumeGamePayload,
} from './interfaces/join-room.use-case.interface';
import { User } from '../types/game.types';
import { AuthenticatedUser } from '../types/user.types';
import { RoomStatus } from '../types/room.types';

@Injectable()
export class JoinRoomUseCase implements IJoinRoomUseCase {
  private readonly logger = new Logger(JoinRoomUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: JoinRoomRequest): Promise<JoinRoomResponse> {
    try {
      const { currentRoomId, targetRoomId, user, authenticatedUser } = request;

      const normalizedUser = this.normalizeUser(user, authenticatedUser);

      const joinSucceeded = await this.roomService.joinRoom(
        targetRoomId,
        normalizedUser,
      );
      if (!joinSucceeded) {
        this.logger.warn(
          `Join room failed for player ${normalizedUser.playerId} in room ${targetRoomId}`,
        );
        return {
          success: false,
          errorMessage: 'Failed to join room',
          normalizedUser,
          previousRoomNotification: currentRoomId
            ? {
                roomId: currentRoomId,
                playerId: normalizedUser.playerId,
              }
            : undefined,
        };
      }

      const room = await this.roomService.getRoom(targetRoomId);
      if (!room) {
        this.logger.error(
          `Room ${targetRoomId} not found after successful join attempt`,
        );
        return {
          success: false,
          errorMessage: 'Room not found after join',
          normalizedUser,
        };
      }

      const data: JoinRoomSuccess = {
        room,
        isHost: room.hostId === normalizedUser.playerId,
        roomStatus: room.status,
        roomsList: await this.roomService.listRooms(),
        resumeGame: await this.buildResumePayloadIfNeeded(room.id, room),
      };

      return {
        success: true,
        normalizedUser,
        previousRoomNotification: currentRoomId
          ? {
              roomId: currentRoomId,
              playerId: normalizedUser.playerId,
            }
          : undefined,
        data,
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error while executing JoinRoomUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        errorMessage: 'Internal server error',
      };
    }
  }

  private normalizeUser(
    user: User,
    authenticatedUser?: AuthenticatedUser | null,
  ): User {
    if (!authenticatedUser) {
      return { ...user };
    }

    const displayName =
      authenticatedUser.profile?.displayName || authenticatedUser.email;

    return {
      ...user,
      name: displayName || user.name,
      userId: authenticatedUser.id,
      isAuthenticated: true,
    };
  }

  private async buildResumePayloadIfNeeded(
    roomId: string,
    room: JoinRoomSuccess['room'],
  ): Promise<ResumeGamePayload | undefined> {
    if (room.status !== RoomStatus.PLAYING) {
      return undefined;
    }

    const actualPlayerCount = room.players.filter(
      (p) => !p.playerId.startsWith('dummy-'),
    ).length;

    if (actualPlayerCount !== room.settings.maxPlayers) {
      return undefined;
    }

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();

    if (state.gamePhase !== null) {
      return undefined;
    }

    const currentTurn =
      state.currentPlayerIndex !== -1 && state.players[state.currentPlayerIndex]
        ? state.players[state.currentPlayerIndex].playerId
        : null;

    return {
      message: 'Game resumed with 4 players.',
      gameState: {
        players: state.players,
        gamePhase: state.gamePhase,
        currentField: state.playState?.currentField ?? null,
        currentTurn,
        blowState: state.blowState,
        teamScores: state.teamScores,
        negriCard: state.playState?.negriCard ?? null,
        fields: state.playState?.fields,
        roomId,
        pointsToWin: room.settings.pointsToWin,
      },
    };
  }
}
