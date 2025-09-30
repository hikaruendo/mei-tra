import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IDeclareBlowUseCase,
  DeclareBlowRequest,
  DeclareBlowResponse,
} from './interfaces/declare-blow.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { GameState } from '../types/game.types';
import { transitionToPlayPhase } from './blow-phase-transition.helper';

@Injectable()
export class DeclareBlowUseCase implements IDeclareBlowUseCase {
  private readonly logger = new Logger(DeclareBlowUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IBlowService') private readonly blowService: IBlowService,
    @Inject('ICardService') private readonly cardService: ICardService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
  ) {}

  async execute(request: DeclareBlowRequest): Promise<DeclareBlowResponse> {
    try {
      const { roomId, socketId, declaration } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.id === socketId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (!roomGameState.isPlayerTurn(player.playerId)) {
        return { success: false, error: "It's not your turn to declare" };
      }

      if (
        !this.blowService.isValidDeclaration(
          declaration,
          state.blowState.currentHighestDeclaration,
        )
      ) {
        return { success: false, error: 'Invalid declaration' };
      }

      const newDeclaration = this.blowService.createDeclaration(
        player.playerId,
        declaration.trumpType,
        declaration.numberOfPairs,
      );

      state.blowState.declarations.push(newDeclaration);
      state.blowState.currentHighestDeclaration = newDeclaration;
      player.isPasser = false;

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'blow-updated',
          payload: {
            declarations: state.blowState.declarations,
            currentHighest: state.blowState.currentHighestDeclaration,
            lastPasser: state.blowState.lastPasser,
          },
        },
      ];

      const playersWhoHaveActed = this.collectPlayersWhoActed(state);

      if (playersWhoHaveActed.size === 4) {
        const transition = await transitionToPlayPhase({
          roomId,
          roomGameState,
          state,
          blowService: this.blowService,
          cardService: this.cardService,
          chomboService: this.chomboService,
        });
        events.push(...transition.events);
        return {
          success: true,
          events,
          delayedEvents: transition.delayedEvents,
          revealBrokenRequest: transition.revealBrokenRequest,
        };
      }

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

      return { success: true, events };
    } catch (error) {
      this.logger.error(
        'Unexpected error in DeclareBlowUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }

  private collectPlayersWhoActed(state: GameState): Set<string> {
    const acted = new Set<string>();
    state.blowState.declarations.forEach((decl) => acted.add(decl.playerId));
    state.players.forEach((p) => {
      if (p.isPasser) {
        acted.add(p.playerId);
      }
    });
    return acted;
  }
}
