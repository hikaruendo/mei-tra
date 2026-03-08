import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  FillWithComRequest,
  FillWithComResponse,
  IFillWithComUseCase,
} from './interfaces/fill-with-com.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';

@Injectable()
export class FillWithComUseCase implements IFillWithComUseCase {
  private readonly logger = new Logger(FillWithComUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: FillWithComRequest): Promise<FillWithComResponse> {
    try {
      const { roomId, playerId } = request;

      // Get the room
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Find the requesting player by playerId
      const requestingPlayer = room.players.find(
        (p) => p.playerId === playerId,
      );
      if (!requestingPlayer) {
        return {
          success: false,
          error: 'Player not found in room',
        };
      }

      // Verify that the requesting player is the host
      if (room.hostId !== playerId) {
        return {
          success: false,
          error: 'Only the host can add COM players',
        };
      }

      // Execute the COM fill operation
      await this.roomService.fillVacantSeatsWithCOM(roomId);

      // Retrieve the updated room
      const updatedRoom = await this.roomService.getRoom(roomId);
      if (!updatedRoom) {
        return { success: false, error: 'Failed to retrieve updated room' };
      }

      return {
        success: true,
        updatedRoom,
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error in FillWithComUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
