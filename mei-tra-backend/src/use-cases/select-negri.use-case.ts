import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SelectNegriRequest,
  SelectNegriResponse,
  ISelectNegriUseCase,
} from './interfaces/select-negri.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';

@Injectable()
export class SelectNegriUseCase implements ISelectNegriUseCase {
  private readonly logger = new Logger(SelectNegriUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IBlowService') private readonly blowService: IBlowService,
  ) {}

  async execute(request: SelectNegriRequest): Promise<SelectNegriResponse> {
    try {
      const { roomId, socketId, card } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.id === socketId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (state.gamePhase !== 'play') {
        return { success: false, error: 'Cannot select Negri card now' };
      }

      if (!roomGameState.isPlayerTurn(player.playerId)) {
        return { success: false, error: "It's not your turn to select Negri" };
      }

      if (!player.hand.includes(card)) {
        return { success: false, error: 'Selected card is not in hand' };
      }

      state.playState = {
        currentField: {
          cards: [],
          baseCard: '',
          dealerId: player.playerId,
          isComplete: false,
        },
        negriCard: card,
        neguri: {},
        fields: [],
        lastWinnerId: null,
        openDeclared: false,
        openDeclarerId: null,
      };

      player.hand = player.hand.filter((c) => c !== card);

      const winner = this.blowService.findHighestDeclaration(
        state.blowState.declarations,
      );
      if (!winner) {
        return {
          success: false,
          error: 'Failed to determine declaration winner',
        };
      }

      const winnerIndex = state.players.findIndex(
        (p) => p.playerId === winner.playerId,
      );
      if (winnerIndex === -1) {
        return {
          success: false,
          error: 'Declaration winner not found among players',
        };
      }

      state.currentPlayerIndex = winnerIndex;

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'update-players',
          payload: state.players,
        },
        {
          scope: 'room',
          roomId,
          event: 'play-setup-complete',
          payload: {
            negriCard: card,
            startingPlayer: state.players[winnerIndex].playerId,
          },
        },
        {
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: state.players[winnerIndex].playerId,
        },
      ];

      await roomGameState.saveState();

      return { success: true, events };
    } catch (error) {
      this.logger.error(
        'Unexpected error in SelectNegriUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
