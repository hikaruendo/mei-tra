import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SelectNegriRequest,
  SelectNegriResponse,
  ISelectNegriUseCase,
} from './interfaces/select-negri.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import {
  buildPlayerSyncEvents,
  resolvePlayerByActorId,
} from './helpers/player-resolution.helper';
import { asSeatId } from '../types/identity.types';
import { setCurrentSeat } from '../domain/current-turn';

@Injectable()
export class SelectNegriUseCase implements ISelectNegriUseCase {
  private readonly logger = new Logger(SelectNegriUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IBlowService') private readonly blowService: IBlowService,
  ) {}

  async execute(request: SelectNegriRequest): Promise<SelectNegriResponse> {
    try {
      const { roomId, actorId, card } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const room = await this.roomService.getRoom(roomId);
      const isProMode = room?.settings.gameMode === 'pro';
      const player = resolvePlayerByActorId(roomGameState, actorId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (state.gamePhase !== 'play') {
        return { success: false, error: 'Cannot select Negri card now' };
      }
      if (!state.playState) {
        return { success: false, error: 'Play state is unavailable' };
      }

      if (!isProMode && !roomGameState.isPlayerTurn(player.seatId)) {
        return { success: false, error: "It's not your turn to select Negri" };
      }

      const winner = this.blowService.findHighestDeclaration(
        state.blowState.declarations,
      );
      if (!winner) {
        return { success: false, error: 'Failed to determine declaration winner' };
      }
      if (winner.seatId !== player.seatId) {
        return { success: false, error: 'Only the declaration winner may select Negri' };
      }
      if (isProMode && (state.playState?.fields.length ?? 0) >= 10) {
        return { success: false, error: 'Negri selection window has ended' };
      }
      if (!player.hand.includes(card)) {
        return { success: false, error: 'Selected card is not in hand' };
      }

      const currentField = state.playState.currentField;
      const playHasStarted = Boolean(
        currentField?.cards.length || state.playState.fields.length,
      );

      if (!state.playState.currentField) {
        state.playState.currentField = {
          cards: [],
          playedBySeatIds: [],
          baseCard: '',
          dealerSeatId: asSeatId(player.seatId),
          isComplete: false,
        };
      }
      state.playState.negriCard = card;
      state.playState.negriSeatId = asSeatId(player.seatId);

      player.hand = player.hand.filter((c) => c !== card);

      const winnerIndex = state.players.findIndex(
        (p) => p.seatId === winner.seatId,
      );
      if (winnerIndex === -1) {
        return {
          success: false,
          error: 'Declaration winner not found among players',
        };
      }

      // A pro-mode Negri can be placed outside the owner's turn. Preserve the
      // active player in that case; only initial Negri selection starts play
      // at the declaration winner as in normal mode.
      if (!isProMode || !playHasStarted) {
        setCurrentSeat(state, winner.seatId);
      }
      const startingSeatId = state.currentSeatId ?? winner.seatId;
      const events: GatewayEvent[] = [
        ...buildPlayerSyncEvents(roomGameState, roomId, state.players, {
          room,
        }),
        {
          scope: 'room',
          roomId,
          event: 'play-setup-complete',
          payload: {
            negriCard: card,
            negriSeatId: asSeatId(player.seatId),
            startingSeatId: asSeatId(startingSeatId),
          },
        },
        {
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: startingSeatId,
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
