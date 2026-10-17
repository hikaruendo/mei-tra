import { Inject, Injectable, Optional } from '@nestjs/common';
import type { SeatId } from '../types/identity.types';
import { RoomStatus } from '../types/room.types';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import type { GatewayEvent } from './interfaces/gateway-event.interface';
import { startNextRound } from './helpers/round-completion.helper';

@Injectable()
export class ConfirmRoundResultsUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async execute(
    roomId: string,
    actorSeatId: SeatId,
  ): Promise<{
    success: boolean;
    error?: string;
    events?: GatewayEvent[];
  }> {
    const room = await this.roomService.getRoom(roomId);
    if (!room || room.status !== RoomStatus.PLAYING) {
      return { success: false, error: 'Game is not active' };
    }
    if (room.hostSeatId !== actorSeatId) {
      return { success: false, error: 'Only the host can continue the game' };
    }

    const roomGameState = await this.roomService.getRoomGameState(roomId);
    const state = roomGameState.getState();
    if (state.gamePhase !== 'round-end' || state.gameOver) {
      return {
        success: false,
        error: 'Round results are not awaiting confirmation',
      };
    }

    const events = await startNextRound(
      roomId,
      roomGameState,
      state,
      room,
      this.gameEventLogService,
    );
    return { success: true, events };
  }
}
