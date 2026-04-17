import { Inject, Injectable } from '@nestjs/common';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IFillWithComUseCase } from './interfaces/fill-with-com.use-case.interface';
import { Room } from '../types/room.types';
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

    if (room.hostId !== request.playerId) {
      return { success: false, error: 'Only the host can shuffle teams' };
    }

    if (room.players.length < 4) {
      const fillResult = await this.fillWithComUseCase.execute({
        roomId: request.roomId,
        playerId: request.playerId,
      });
      if (fillResult.success && fillResult.updatedRoom) {
        room = fillResult.updatedRoom;
      }
    }

    const shuffled = [...room.players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const half = Math.floor(shuffled.length / 2);
    shuffled.forEach((player, idx) => {
      player.team = (idx < half ? 0 : 1) as Team;
    });

    room.updatedAt = new Date();
    room.players = shuffled;
    const updatedRoom = await this.roomService.updateRoom(request.roomId, room);
    if (!updatedRoom) {
      return { success: false, error: 'Failed to change teams' };
    }

    return { success: true, updatedRoom };
  }
}
