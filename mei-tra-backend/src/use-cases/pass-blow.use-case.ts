import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { RoundCancelledPayload } from '@contracts/game';
import { toBlowUpdatedPayload } from '../adapters/game-contract-adapters';
import {
  IPassBlowUseCase,
  PassBlowRequest,
  PassBlowResponse,
} from './interfaces/pass-blow.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IBlowService } from '../services/interfaces/blow-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { GameState } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import {
  buildPlayerSyncEvents,
  resolvePlayerByActorId,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import {
  transitionToPlayPhase,
  TransitionResult,
} from './blow-phase-transition.helper';
import {
  getBrokenHandRevealPendingError,
  getRequiredBrokenHandRevealError,
} from './helpers/broken-hand.helper';
import {
  countPlayersActedInBlow,
  hasPlayerDeclaredInBlow,
  hasPlayerPassedInBlow,
} from './helpers/blow-action.helper';
import { asSeatId } from '../types/identity.types';
import { resolveCurrentPlayer, setCurrentSeat } from '../domain/current-turn';

@Injectable()
export class PassBlowUseCase implements IPassBlowUseCase {
  private readonly logger = new Logger(PassBlowUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IBlowService') private readonly blowService: IBlowService,
    @Inject('ICardService') private readonly cardService: ICardService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async execute(request: PassBlowRequest): Promise<PassBlowResponse> {
    try {
      const { roomId, actorId } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = resolvePlayerByActorId(roomGameState, actorId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (state.gamePhase !== 'blow') {
        return { success: false, error: 'Cannot pass now' };
      }

      const pendingError = await getBrokenHandRevealPendingError(roomGameState);
      if (pendingError) {
        return { success: false, error: pendingError };
      }

      if (!roomGameState.isPlayerTurn(player.seatId)) {
        return { success: false, error: "It's not your turn to pass" };
      }

      const requiredBrokenError = getRequiredBrokenHandRevealError(player);
      if (requiredBrokenError) {
        return { success: false, error: requiredBrokenError };
      }

      // Check if player has already passed in this blow phase
      if (hasPlayerPassedInBlow(state.blowState, player)) {
        return {
          success: false,
          error: 'You have already passed in this blow phase',
        };
      }

      // Check if player has already declared in this blow phase
      if (hasPlayerDeclaredInBlow(state.blowState, player.seatId)) {
        return {
          success: false,
          error: 'You have already declared in this blow phase',
        };
      }

      state.blowState.actionHistory ??= [];
      player.isPasser = true;
      state.blowState.actionHistory.push({
        type: 'pass',
        seatId: asSeatId(player.seatId),
        timestamp: Date.now(),
      });
      state.blowState.lastPasserSeatId = asSeatId(player.seatId);

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'blow_passed',
        actorSeatId: asSeatId(player.seatId),
        state,
        actionData: {
          declarationsCount: state.blowState.declarations.length,
          lastPasserSeatId: state.blowState.lastPasserSeatId,
          actedCount: countPlayersActedInBlow(state.players, state.blowState),
        },
      });
      const room = await this.roomService.getRoom(roomId);

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'blow-updated',
          payload: toBlowUpdatedPayload(state.blowState),
        },
      ];
      events.push(
        ...buildPlayerSyncEvents(roomGameState, roomId, state.players, {
          room,
        }),
      );

      // Calculate how many players have acted (declared or passed)
      const actedCount = countPlayersActedInBlow(
        state.players,
        state.blowState,
      );

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
          room,
          state,
          blowService: this.blowService,
          cardService: this.cardService,
          gameEventLogService: this.gameEventLogService,
        });

        return {
          success: true,
          events: [...events, ...transition.events],
          delayedEvents: transition.delayedEvents,
        };
      }

      // 3. Not all players have acted yet → continue to next player
      roomGameState.nextTurn();

      // Skip players who have already acted (passed or declared)
      let attempts = 0;
      const maxAttempts = state.players.length;
      while (attempts < maxAttempts) {
        const currentPlayer = resolveCurrentPlayer(state);
        if (!currentPlayer) {
          break;
        }
        const hasActed =
          hasPlayerDeclaredInBlow(state.blowState, currentPlayer.seatId) ||
          hasPlayerPassedInBlow(state.blowState, currentPlayer);

        if (!hasActed) {
          break; // Found a player who hasn't acted yet
        }

        roomGameState.nextTurn();
        attempts++;
      }

      // Save the final turn state after skipping
      await roomGameState.saveState();

      const nextPlayer = resolveCurrentPlayer(state);
      if (nextPlayer) {
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: nextPlayer.seatId,
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
    state.blowState.lastPasserSeatId = null;
    state.blowState.declarations = [];
    state.blowState.actionHistory = [];
    state.blowState.currentHighestDeclaration = null;

    // 全員パスの再配りでは吹き始めは移らず、同じ席がもう一度最初に吹く。
    // 吹き始めが進むのはラウンド成立時 (CompleteFieldUseCase.prepareNextRound) と
    // ブロークン / 4ジャックの再配り (RevealBrokenHandUseCase) だけ。
    const firstBlowIndex =
      state.blowState.currentBlowIndex % state.players.length;
    const firstBlowPlayer = state.players[firstBlowIndex];

    if (!firstBlowPlayer) {
      return { events: [] };
    }

    state.blowState.currentBlowIndex = firstBlowIndex;
    setCurrentSeat(state, firstBlowPlayer.seatId);
    state.deck = this.cardService.generateDeck();
    roomGameState.dealCards();

    await this.gameEventLogService?.log({
      roomId,
      actionType: 'round_cancelled',
      actorSeatId: null,
      state,
      actionData: {
        reason: 'no_declarations',
        nextDealerSeatId: firstBlowPlayer.seatId,
        nextBlowIndex: firstBlowIndex,
      },
    });

    await roomGameState.saveState();
    const room = await this.roomService.getRoom(roomId);

    const playerSyncEvents = buildPlayerSyncEvents(
      roomGameState,
      roomId,
      state.players,
      {
        room,
      },
    );
    const roundCancelledPayload: RoundCancelledPayload = {
      nextDealerSeatId: asSeatId(firstBlowPlayer.seatId),
      players: resolveTransportPlayers(roomGameState, state.players, {
        roomPlayers: room?.players,
      }),
    };

    const events: GatewayEvent[] = [
      ...playerSyncEvents,
      {
        scope: 'room',
        roomId,
        event: 'blow-updated',
        payload: {
          declarations: [],
          actionHistory: [],
          currentHighest: null,
          lastPasserSeatId: null,
        },
      },
      {
        scope: 'room',
        roomId,
        event: 'round-cancelled',
        payload: roundCancelledPayload,
      },
      {
        scope: 'room',
        roomId,
        event: 'update-turn',
        payload: firstBlowPlayer.seatId,
      },
    ];
    return { events };
  }
}
