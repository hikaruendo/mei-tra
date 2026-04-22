import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
import {
  buildPlayerSyncEvents,
  resolvePlayerByActorId,
} from './helpers/player-resolution.helper';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import {
  transitionToPlayPhase,
  TransitionResult,
} from './blow-phase-transition.helper';

@Injectable()
export class DeclareBlowUseCase implements IDeclareBlowUseCase {
  private readonly logger = new Logger(DeclareBlowUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IBlowService') private readonly blowService: IBlowService,
    @Inject('ICardService') private readonly cardService: ICardService,
    @Inject('IChomboService') private readonly chomboService: IChomboService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async execute(request: DeclareBlowRequest): Promise<DeclareBlowResponse> {
    try {
      const { roomId, actorId, declaration } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = resolvePlayerByActorId(roomGameState, actorId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (!roomGameState.isPlayerTurn(player.playerId)) {
        return { success: false, error: "It's not your turn to declare" };
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

      // Check if player has already passed in this blow phase
      if (player.isPasser) {
        return {
          success: false,
          error: 'You have already passed in this blow phase',
        };
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

      state.blowState.actionHistory ??= [];
      state.blowState.declarations.push(newDeclaration);
      state.blowState.actionHistory.push({
        type: 'declare',
        playerId: player.playerId,
        trumpType: declaration.trumpType,
        numberOfPairs: declaration.numberOfPairs,
        timestamp: newDeclaration.timestamp,
      });
      state.blowState.currentHighestDeclaration = newDeclaration;

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'blow_declared',
        playerId: player.playerId,
        state,
        actionData: {
          declaration: {
            trumpType: declaration.trumpType,
            numberOfPairs: declaration.numberOfPairs,
          },
          currentHighestDeclaration: state.blowState.currentHighestDeclaration,
          declarationsCount: state.blowState.declarations.length,
        },
      });
      const room = await this.roomService.getRoom(roomId);

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'blow-updated',
          payload: {
            declarations: state.blowState.declarations,
            actionHistory: state.blowState.actionHistory,
            currentHighest: state.blowState.currentHighestDeclaration,
            lastPasser: state.blowState.lastPasser,
          },
        },
      ];
      events.push(
        ...buildPlayerSyncEvents(roomGameState, roomId, state.players, {
          room,
        }),
      );

      // Calculate how many players have acted (declared or passed)
      const actedCount = state.players.filter((p) => {
        const hasDeclared = state.blowState.declarations.some(
          (d) => d.playerId === p.playerId,
        );
        return hasDeclared || p.isPasser;
      }).length;

      // If all players have acted, transition to play phase
      if (actedCount === state.players.length) {
        const transition: TransitionResult = await transitionToPlayPhase({
          roomId,
          roomGameState,
          room,
          state,
          blowService: this.blowService,
          cardService: this.cardService,
          chomboService: this.chomboService,
          gameEventLogService: this.gameEventLogService,
        });

        return {
          success: true,
          events: [...events, ...transition.events],
          delayedEvents: transition.delayedEvents,
          revealBrokenRequest: transition.revealBrokenRequest,
        };
      }

      // Not all players have acted yet - continue to next player
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
        'Unexpected error in DeclareBlowUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
