import { Inject, Injectable } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IFillWithComUseCase } from './interfaces/fill-with-com.use-case.interface';
import { Room, RoomStatus } from '../types/room.types';
import { Team } from '../types/game.types';

@Injectable()
export class ShuffleTeamsUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IFillWithComUseCase')
    private readonly fillWithComUseCase: IFillWithComUseCase,
  ) {}

  async execute(request: {
    roomId: string;
    playerId: string;
  }): Promise<{ success: boolean; updatedRoom?: Room; error?: string }> {
    let room = await this.roomService.getRoom(request.roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.status !== RoomStatus.WAITING) {
      return {
        success: false,
        error: 'Teams can only be shuffled while waiting',
      };
    }

    if (room.hostSeatId !== request.playerId) {
      return { success: false, error: 'Only the host can shuffle teams' };
    }

    if (room.players.length < 4) {
      const fillResult = await this.fillWithComUseCase.execute({
        roomId: request.roomId,
        playerId: request.playerId,
      });
      if (!fillResult.success || !fillResult.updatedRoom) {
        return {
          success: false,
          error: fillResult.error || 'Failed to fill empty seats',
        };
      }
      room = fillResult.updatedRoom;
    }

    const shuffled = [...room.players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const half = Math.floor(shuffled.length / 2);
    const shuffledPlayers = shuffled.map((player, seatIndex) => ({
      ...player,
      team: (seatIndex < half ? 0 : 1) as Team,
      seatIndex,
    }));

    try {
      const roomGameState = await this.roomService.getRoomGameState(
        request.roomId,
      );
      await roomGameState.reconcileWaitingRoomPlayers(shuffledPlayers);
    } catch {
      return { success: false, error: 'Failed to change teams' };
    }

    const updatedRoom = await this.roomService.getRoom(request.roomId);
    if (!updatedRoom) {
      return { success: false, error: 'Failed to change teams' };
    }

    return { success: true, updatedRoom };
  }
}
