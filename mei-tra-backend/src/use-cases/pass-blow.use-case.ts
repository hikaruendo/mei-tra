import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IPassBlowUseCase,
  PassBlowRequest,
  PassBlowResponse,
} from './interfaces/pass-blow.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { GameState } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import {
  transitionToPlayPhase,
  TransitionResult,
} from './blow-phase-transition.helper';

@Injectable()
export class PassBlowUseCase implements IPassBlowUseCase {
  private readonly logger = new Logger(PassBlowUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IBlowService') private readonly blowService: IBlowService,
    @Inject('ICardService') private readonly cardService: ICardService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
  ) {}

  async execute(request: PassBlowRequest): Promise<PassBlowResponse> {
    try {
      const { roomId, socketId } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.id === socketId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (!roomGameState.isPlayerTurn(player.playerId)) {
        return { success: false, error: "It's not your turn to pass" };
      }

      // Check if player has already passed in this blow phase
      if (player.isPasser) {
        return {
          success: false,
          error: 'You have already passed in this blow phase',
        };
      }

      // Check if player has already declared in this blow phase
      const alreadyDeclared = state.blowState.declarations.some(
        (d) => d.playerId === player.playerId,
      );
      if (alreadyDeclared) {
        return {
          success: false,
          error: 'You have already declared in this blow phase',
        };
      }

      player.isPasser = true;
      state.blowState.lastPasser = player.playerId;

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'blow-updated',
          payload: {
            declarations: state.blowState.declarations,
            currentHighest: state.blowState.currentHighestDeclaration,
            lastPasser: player.playerId,
          },
        },
        {
          scope: 'room',
          roomId,
          event: 'update-players',
          payload: state.players,
        },
      ];

      // Calculate how many players have acted (declared or passed)
      const actedCount = state.players.filter((p) => {
        const hasDeclared = state.blowState.declarations.some(
          (d) => d.playerId === p.playerId,
        );
        return hasDeclared || p.isPasser;
      }).length;

      const totalPlayers = state.players.length;
      const hasDeclarations = state.blowState.declarations.length > 0;

      // 1. All players acted & no declarations → redeal
      if (actedCount === totalPlayers && !hasDeclarations) {
        const resetResult = await this.handleNoDeclarations(
          roomId,
          roomGameState,
          state,
        );
        events.push(...resetResult.events);
        return { success: true, events };
      }

      // 2. All players acted & have declarations → transition to play phase
      if (actedCount === totalPlayers && hasDeclarations) {
        const transition: TransitionResult = await transitionToPlayPhase({
          roomId,
          roomGameState,
          state,
          blowService: this.blowService,
          cardService: this.cardService,
          chomboService: this.chomboService,
        });

        return {
          success: true,
          events: [...events, ...transition.events],
          delayedEvents: transition.delayedEvents,
          revealBrokenRequest: transition.revealBrokenRequest,
        };
      }

      // 3. Not all players have acted yet → continue to next player
      await roomGameState.nextTurn();

      // Skip players who have already acted (passed or declared)
      let attempts = 0;
      const maxAttempts = state.players.length;
      while (attempts < maxAttempts) {
        const currentPlayer = state.players[state.currentPlayerIndex];
        const hasDeclared = state.blowState.declarations.some(
          (d) => d.playerId === currentPlayer.playerId,
        );
        const hasActed = hasDeclared || currentPlayer.isPasser;

        if (!hasActed) {
          break; // Found a player who hasn't acted yet
        }

        await roomGameState.nextTurn();
        attempts++;
      }

      // Save the final turn state after skipping
      await roomGameState.saveState();

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
        'Unexpected error in PassBlowUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }

  private async handleNoDeclarations(
    roomId: string,
    roomGameState: GameStateService,
    state: GameState,
  ): Promise<{ events: GatewayEvent[] }> {
    state.players.forEach((p) => (p.isPasser = false));
    state.blowState.lastPasser = null;
    state.blowState.declarations = [];
    state.blowState.currentHighestDeclaration = null;
    state.blowState.currentBlowIndex =
      (state.blowState.currentBlowIndex + 1) % state.players.length;

    await roomGameState.nextTurn();
    const nextDealerIndex = state.currentPlayerIndex;
    const firstBlowIndex = (nextDealerIndex + 1) % state.players.length;
    const firstBlowPlayer = state.players[firstBlowIndex];

    if (!firstBlowPlayer) {
      return { events: [] };
    }

    state.currentPlayerIndex = firstBlowIndex;
    state.deck = this.cardService.generateDeck();
    await roomGameState.dealCards();
    await roomGameState.saveState();

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
        event: 'blow-updated',
        payload: {
          declarations: [],
          currentHighest: null,
          lastPasser: null,
        },
      },
      {
        scope: 'room',
        roomId,
        event: 'round-cancelled',
        payload: {
          nextDealer: firstBlowPlayer.playerId,
          players: state.players,
        },
      },
      {
        scope: 'room',
        roomId,
        event: 'update-turn',
        payload: firstBlowPlayer.playerId,
      },
    ];

    return { events };
  }
}
