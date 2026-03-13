import { Injectable, Logger, Inject } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  CreateRoomRequest,
  CreateRoomResponse,
  ICreateRoomUseCase,
} from './interfaces/create-room.use-case.interface';

@Injectable()
export class CreateRoomUseCase implements ICreateRoomUseCase {
  private readonly logger = new Logger(CreateRoomUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    try {
      const {
        roomName,
        pointsToWin,
        teamAssignmentMethod,
        playerName,
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

      const room = await this.roomService.createNewRoom(
        roomName,
        playerId,
        pointsToWin,
        teamAssignmentMethod,
      );

      const roomsList = await this.roomService.listRooms();

      return {
        success: true,
        data: {
          room,
          roomsList,
        },
      };
    } catch (error) {
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
}
