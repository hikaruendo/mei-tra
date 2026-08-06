import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  CreateRoomRequest,
  CreateRoomResponse,
  ICreateRoomUseCase,
} from './interfaces/create-room.use-case.interface';
import { ChatService } from '../services/chat.service';
import { SessionUser } from '../types/session.types';
import { ActiveRoomMembershipConflictError } from '../types/room-membership.types';

type ChatRoomCreator = {
  createRoom(
    request: Parameters<ChatService['createRoom']>[0],
  ): Promise<unknown>;
};

@Injectable()
export class CreateRoomUseCase implements ICreateRoomUseCase {
  private readonly logger = new Logger(CreateRoomUseCase.name);
  private readonly chatRoomService: ChatRoomCreator;

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Optional() chatService?: ChatService,
  ) {
    this.chatRoomService = chatService ?? {
      createRoom: () => Promise.resolve(undefined),
    };
  }

  async execute(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    let createdRoomId: string | null = null;
    let creatingUserId: string | null = null;
    try {
      const {
        roomName,
        pointsToWin,
        teamAssignmentMethod,
        playerName,
        socketId,
        authenticatedUser,
      } = request;

      if (!playerName) {
        this.logger.warn('Room creation attempted without player name');
        return {
          success: false,
          errorMessage: 'Name is required',
        };
      }

      // For authenticated users, playerId === userId (set in addPlayer).
      // Use the stable userId directly — no socket.id lookup needed.
      const playerId = authenticatedUser?.id;
      if (!playerId) {
        this.logger.error('No authenticated user for room creation');
        return {
          success: false,
          errorMessage: 'Authentication required to create a room.',
        };
      }
      creatingUserId = playerId;

      const room = await this.roomService.createNewRoom(
        roomName,
        playerId,
        pointsToWin,
        teamAssignmentMethod,
      );
      createdRoomId = room.id;

      const hostUser: SessionUser = {
        socketId,
        playerId: authenticatedUser.id,
        name: playerName,
        userId: authenticatedUser.id,
        isAuthenticated: true,
      };

      const joined = await this.roomService.joinRoom(room.id, hostUser);
      if (!joined) {
        await this.cleanupFailedCreation(room.id, playerId);
        return {
          success: false,
          errorMessage: 'Failed to join created room',
        };
      }

      await this.roomService.initCOMPlaceholders(room.id);
      const updatedRoom = await this.roomService.getRoom(room.id);
      if (!updatedRoom) {
        await this.cleanupFailedCreation(room.id, playerId);
        return {
          success: false,
          errorMessage: 'Failed to load created room',
        };
      }

      const hostPlayer = updatedRoom.players.find(
        (player) => player.playerId === hostUser.playerId,
      );
      if (!hostPlayer) {
        await this.cleanupFailedCreation(room.id, playerId);
        return {
          success: false,
          errorMessage: 'Host player not found in created room',
        };
      }

      try {
        await this.chatRoomService.createRoom({
          id: room.id,
          scope: 'table',
          name: `Game: ${room.name}`,
          ownerId: authenticatedUser.id,
          visibility: 'private',
          messageTtlHours: 24,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to create chat room for game room ${room.id}: ${String(error)}`,
        );
      }

      const roomsList = await this.roomService.listRooms();

      return {
        success: true,
        data: {
          room: updatedRoom,
          roomsList,
          hostPlayer,
        },
      };
    } catch (error) {
      if (createdRoomId && creatingUserId) {
        await this.cleanupFailedCreation(createdRoomId, creatingUserId);
      } else if (creatingUserId) {
        await this.roomService.cancelRoomMembershipReservation(creatingUserId);
      }
      if (error instanceof ActiveRoomMembershipConflictError) {
        return {
          success: false,
          errorMessage: 'You are already active in another room.',
        };
      }
      this.logger.error(
        'Unexpected error while executing CreateRoomUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        errorMessage: 'Failed to create room',
      };
    }
  }

  private async cleanupFailedCreation(
    roomId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomId);
    } catch (error) {
      this.logger.error(
        `Failed to delete incomplete room ${roomId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    try {
      await this.roomService.cancelRoomMembershipReservation(userId);
    } catch (error) {
      this.logger.error(
        `Failed to cancel incomplete room reservation for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
