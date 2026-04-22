import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { BrokenPayload } from '@contracts/game';
import {
  IRevealBrokenHandUseCase,
  RevealBrokenHandRequest,
  RevealBrokenHandPreparation,
  RevealBrokenHandCompletion,
} from './interfaces/reveal-broken-hand.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import {
  resolvePlayerByActorId,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';

@Injectable()
export class RevealBrokenHandUseCase implements IRevealBrokenHandUseCase {
  private readonly logger = new Logger(RevealBrokenHandUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('ICardService') private readonly cardService: ICardService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async prepare(
    request: RevealBrokenHandRequest,
  ): Promise<RevealBrokenHandPreparation> {
    try {
      const { roomId, actorId, playerId } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const player = resolvePlayerByActorId(roomGameState, actorId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (player.playerId !== playerId) {
        return { success: false, error: 'Player mismatch for broken hand' };
      }

      return {
        success: true,
        delayMs: 3000,
        followUp: { roomId, playerId },
      };
    } catch (error) {
      this.logger.error(
        'Unexpected error in RevealBrokenHandUseCase.prepare',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }

  async finalize(followUp: {
    roomId: string;
    playerId: string;
  }): Promise<RevealBrokenHandCompletion> {
    try {
      const { roomId, playerId } = followUp;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.playerId === playerId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      await roomGameState.transitionPhase('blow');
      const nextState = roomGameState.getState();

      nextState.playState = {
        currentField: null,
        negriCard: null,
        neguri: {},
        fields: [],
        lastWinnerId: null,
        openDeclared: false,
        openDeclarerId: null,
      };

      nextState.blowState.declarations = [];
      nextState.blowState.actionHistory = [];
      nextState.blowState.currentHighestDeclaration = null;
      nextState.blowState.lastPasser = null;

      const firstBlowIndex = nextState.blowState.currentBlowIndex;
      const firstBlowPlayer = nextState.players[firstBlowIndex];

      nextState.currentPlayerIndex = firstBlowIndex;
      nextState.deck = this.cardService.generateDeck();
      await roomGameState.dealCards();

      const events: GatewayEvent[] = [];
      if (firstBlowPlayer) {
        const brokenPayload: BrokenPayload = {
          nextPlayerId: firstBlowPlayer.playerId,
          players: resolveTransportPlayers(roomGameState, nextState.players),
          gamePhase: 'blow',
        };

        events.push({
          scope: 'room',
          roomId,
          event: 'broken',
          payload: brokenPayload,
        });
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: firstBlowPlayer.playerId,
        });
      }

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'broken_hand_revealed',
        playerId,
        state: nextState,
        actionData: {
          nextPlayerId: firstBlowPlayer?.playerId ?? null,
          nextBlowIndex: firstBlowIndex,
          startingHandsByPlayerId: Object.fromEntries(
            nextState.players.map((statePlayer) => [
              statePlayer.playerId,
              [...statePlayer.hand],
            ]),
          ),
        },
      });

      await roomGameState.saveState();

      return { success: true, events };
    } catch (error) {
      this.logger.error(
        'Unexpected error in RevealBrokenHandUseCase.finalize',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
