import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ISelectBaseSuitUseCase,
  SelectBaseSuitRequest,
  SelectBaseSuitResponse,
} from './interfaces/select-base-suit.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';

@Injectable()
export class SelectBaseSuitUseCase implements ISelectBaseSuitUseCase {
  private readonly logger = new Logger(SelectBaseSuitUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(
    request: SelectBaseSuitRequest,
  ): Promise<SelectBaseSuitResponse> {
    try {
      const { roomId, socketId, suit } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();

      if (
        !state.playState?.currentField ||
        state.playState.currentField.baseCard !== 'JOKER'
      ) {
        return { success: false, error: 'Cannot select base suit now' };
      }

      const player = state.players.find((p) => p.id === socketId);
      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (state.playState.currentField.dealerId !== player.playerId) {
        return {
          success: false,
          error: "It's not your turn to select base suit",
        };
      }

      state.playState.currentField.baseSuit = suit;

      await roomGameState.saveState();

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'field-updated',
          payload: state.playState.currentField,
        },
      ];

      await roomGameState.nextTurn();
      const nextPlayer = state.players[state.currentPlayerIndex];
      if (nextPlayer) {
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: nextPlayer.playerId,
        });
      }

      await roomGameState.saveState();

      return { success: true, events };
    } catch (error) {
      this.logger.error(
        'Unexpected error in SelectBaseSuitUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
