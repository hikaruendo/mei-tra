import { Injectable, Logger, Inject } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  IJoinRoomUseCase,
  JoinRoomRequest,
  JoinRoomResponse,
  JoinRoomSuccess,
  PreviousRoomNotification,
  ResumeGamePayload,
} from './interfaces/join-room.use-case.interface';
import { RoomStatus } from '../types/room.types';
import { SessionUser } from '../types/session.types';
import { ActiveRoomMembershipConflictError } from '../types/room-membership.types';
import { resolveCurrentSeatId } from '../domain/current-turn';
import { asSeatId } from '../types/identity.types';

@Injectable()
export class JoinRoomUseCase implements IJoinRoomUseCase {
  private readonly logger = new Logger(JoinRoomUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: JoinRoomRequest): Promise<JoinRoomResponse> {
    try {
      const { currentRoomId, targetRoomId } = request;

      const normalizedUser = this.normalizeUser(request);
      if (!normalizedUser) {
        return {
          success: false,
          errorMessage: 'Authentication required to join room',
        };
      }
      const previousRoomNotification = await this.buildPreviousRoomNotification(
        currentRoomId,
        normalizedUser,
      );

      const joinSucceeded = await this.roomService.joinRoom(
        targetRoomId,
        normalizedUser,
      );
      if (!joinSucceeded) {
        this.logger.warn(
          `Join room failed for user ${normalizedUser.userId} in room ${targetRoomId}`,
        );
        return {
          success: false,
          errorMessage: 'Failed to join room',
          normalizedUser,
          previousRoomNotification,
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

      const joinedPlayer = this.resolveJoinedRoomPlayer(room, normalizedUser);
      if (!joinedPlayer) {
        this.logger.error(
          `Joined player could not be resolved for user ${normalizedUser.userId} in room ${targetRoomId}`,
        );
        return {
          success: false,
          errorMessage: 'Failed to resolve joined player',
          normalizedUser,
          previousRoomNotification,
        };
      }
      const resolvedUser: SessionUser = {
        ...normalizedUser,
        seatId: asSeatId(joinedPlayer.seatId),
      };
      const data: JoinRoomSuccess = {
        room,
        isHost: room.hostSeatId === joinedPlayer.seatId,
        roomStatus: room.status,
        roomsList: await this.roomService.listRooms(),
        resumeGame: await this.buildResumePayloadIfNeeded(room.id, room),
      };

      return {
        success: true,
        normalizedUser: resolvedUser,
        previousRoomNotification,
        data,
      };
    } catch (error) {
      if (error instanceof ActiveRoomMembershipConflictError) {
        return {
          success: false,
          errorMessage: 'You are already active in another room.',
        };
      }
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

  private normalizeUser(request: JoinRoomRequest): SessionUser | null {
    const authenticatedUser = request.authenticatedUser;
    if (!authenticatedUser) {
      return null;
    }

    const displayName =
      authenticatedUser.profile?.displayName ||
      authenticatedUser.email ||
      'User';

    return {
      socketId: request.socketId,
      name: displayName,
      userId: authenticatedUser.id,
      isAuthenticated: true,
    };
  }

  private resolveJoinedRoomPlayer(
    room: JoinRoomSuccess['room'],
    normalizedUser: SessionUser,
  ) {
    if (normalizedUser.userId) {
      const playersByUserId = room.players.filter(
        (player) => !player.isCOM && player.userId === normalizedUser.userId,
      );
      if (playersByUserId.length === 1) {
        return playersByUserId[0];
      }
      if (playersByUserId.length > 1) {
        return null;
      }
    }

    return (
      room.players.find((player) => player.seatId === normalizedUser.seatId) ??
      null
    );
  }

  private async buildPreviousRoomNotification(
    currentRoomId: string | undefined,
    normalizedUser: SessionUser,
  ): Promise<PreviousRoomNotification | undefined> {
    if (!currentRoomId) {
      return undefined;
    }

    const currentRoom = await this.roomService.getRoom(currentRoomId);
    const currentRoomPlayer = currentRoom
      ? this.resolveJoinedRoomPlayer(currentRoom, normalizedUser)
      : null;

    return {
      roomId: currentRoomId,
      seatId: asSeatId(
        currentRoomPlayer?.seatId ??
          normalizedUser.seatId ??
          normalizedUser.userId!,
      ),
    };
  }

  private async buildResumePayloadIfNeeded(
    roomId: string,
    room: JoinRoomSuccess['room'],
  ): Promise<ResumeGamePayload | undefined> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();

    const isPlaying = room.status === RoomStatus.PLAYING;
    if (!isPlaying) {
      return undefined;
    }

    // COMが残っていても、ゲーム中フェーズ（blow/play）でも game-state を送る
    // （プレイ中ルームへの途中参加・COM引き継ぎに対応）

    const currentTurnSeatId = resolveCurrentSeatId(state);

    return {
      message: 'Joined active game.',
      gameState: {
        players: state.players,
        gamePhase: state.gamePhase,
        currentField: state.playState?.currentField ?? null,
        currentTurnSeatId,
        blowState: state.blowState,
        teamScores: state.teamScores,
        negriCard: state.playState?.negriCard ?? null,
        negriSeatId: state.playState?.negriSeatId
          ? asSeatId(state.playState.negriSeatId)
          : null,
        fields: state.playState?.fields,
        roomId,
        pointsToWin: room.settings.pointsToWin,
        teamNames: room.settings.teamNames,
      },
    };
  }
}
