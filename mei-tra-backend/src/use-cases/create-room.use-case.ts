import { Injectable, Logger, Inject } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameStateService } from '../services/interfaces/game-state-service.interface';
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
    @Inject('IGameStateService')
    private readonly gameStateService: IGameStateService,
  ) {}

  async execute(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    try {
      const {
        clientId,
        roomName,
        pointsToWin,
        teamAssignmentMethod,
        playerName,
      } = request;

      if (!playerName) {
        this.logger.warn('Room creation attempted without player name', {
          clientId,
        });
        return {
          success: false,
          errorMessage: 'Name is required',
        };
      }

      const user = this.gameStateService
        .getUsers()
        .find((p) => p.id === clientId);

      if (!user) {
        this.logger.error('Player not found in game state for room creation', {
          clientId,
        });
        return {
          success: false,
          errorMessage: 'Player not found in game state. Please reconnect.',
        };
      }

      const room = await this.roomService.createNewRoom(
        roomName,
        user.playerId,
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
