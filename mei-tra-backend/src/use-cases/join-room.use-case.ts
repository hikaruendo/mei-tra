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
import { AuthenticatedUser } from '../types/user.types';
import { RoomStatus } from '../types/room.types';
import { SessionUser } from '../types/session.types';
import { ActiveRoomMembershipConflictError } from '../types/room-membership.types';

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
      const previousRoomNotification =
        await this.buildPreviousRoomNotification(
          currentRoomId,
          normalizedUser,
        );

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
      const data: JoinRoomSuccess = {
        room,
        isHost: joinedPlayer
          ? room.hostId === joinedPlayer.playerId
          : room.hostId === normalizedUser.playerId,
        roomStatus: room.status,
        roomsList: await this.roomService.listRooms(),
        resumeGame: await this.buildResumePayloadIfNeeded(room.id, room),
      };

      return {
        success: true,
        normalizedUser,
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

  private normalizeUser(
    user: SessionUser,
    authenticatedUser?: AuthenticatedUser | null,
  ): SessionUser {
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

  private resolveJoinedRoomPlayer(
    room: JoinRoomSuccess['room'],
    normalizedUser: SessionUser,
  ) {
    if (normalizedUser.userId) {
      const playerByUserId = room.players.find(
        (player) => !player.isCOM && player.userId === normalizedUser.userId,
      );
      if (playerByUserId) {
        return playerByUserId;
      }
    }

    return (
      room.players.find(
        (player) => player.playerId === normalizedUser.playerId,
      ) ?? null
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
      playerId: currentRoomPlayer?.playerId ?? normalizedUser.playerId,
    };
  }

  private async buildResumePayloadIfNeeded(
    roomId: string,
    room: JoinRoomSuccess['room'],
  ): Promise<ResumeGamePayload | undefined> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();

    // room.status の fallback（WAITING→PLAYING 状態遷移バグがある既存ルームも考慮）
    const isPlaying =
      room.status === RoomStatus.PLAYING || state.gamePhase !== null;
    if (!isPlaying) {
      return undefined;
    }

    // COMが残っていても、ゲーム中フェーズ（blow/play）でも game-state を送る
    // （プレイ中ルームへの途中参加・COM引き継ぎに対応）

    const currentTurn =
      state.currentPlayerId &&
      state.players.some((player) => player.playerId === state.currentPlayerId)
        ? state.currentPlayerId
        : state.currentPlayerIndex !== -1 &&
            state.players[state.currentPlayerIndex]
          ? state.players[state.currentPlayerIndex].playerId
          : null;

    return {
      message: 'Joined active game.',
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
        teamNames: room.settings.teamNames,
      },
    };
  }
}
