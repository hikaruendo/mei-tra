import { Injectable, Logger, Inject } from '@nestjs/common';
import { ITogglePlayerReadyUseCase } from './interfaces/toggle-player-ready.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import {
  TogglePlayerReadyRequest,
  TogglePlayerReadyResponse,
} from './interfaces/toggle-player-ready.use-case.interface';
import { RoomStatus } from '../types/room.types';

@Injectable()
export class TogglePlayerReadyUseCase implements ITogglePlayerReadyUseCase {
  private readonly logger = new Logger(TogglePlayerReadyUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(
    request: TogglePlayerReadyRequest,
  ): Promise<TogglePlayerReadyResponse> {
    try {
      const { roomId, playerId } = request;
      const room = await this.roomService.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      const player = room.players.find((p) => p.playerId === playerId);
      if (!player) {
        return { success: false, error: 'Player not found in room' };
      }

      const newReadyState = !player.isReady;
      const updateSuccess = await this.roomService.updatePlayerInRoom(
        roomId,
        playerId,
        { isReady: newReadyState },
      );

      if (!updateSuccess) {
        return {
          success: false,
          error: 'Failed to update player ready state',
        };
      }

      player.isReady = newReadyState;

      const actualPlayerCount = room.players.filter(
        (p) => !p.playerId.startsWith('dummy-'),
      ).length;
      const hasMaxPlayers = actualPlayerCount === room.settings.maxPlayers;
      const allReady = room.players.every((p) => p.isReady);

      const newRoomStatus =
        allReady && hasMaxPlayers ? RoomStatus.READY : RoomStatus.WAITING;

      if (room.status !== newRoomStatus) {
        await this.roomService.updateRoomStatus(roomId, newRoomStatus);
        room.status = newRoomStatus;
      }

      const updatedRoom = await this.roomService.getRoom(roomId);
      return {
        success: true,
        updatedRoom: updatedRoom ?? room,
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error in TogglePlayerReadyUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
