import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IRevealBrokenHandUseCase,
  RevealBrokenHandRequest,
  RevealBrokenHandPreparation,
  RevealBrokenHandCompletion,
} from './interfaces/reveal-broken-hand.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { ICardService } from '../services/interfaces/card-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';

@Injectable()
export class RevealBrokenHandUseCase implements IRevealBrokenHandUseCase {
  private readonly logger = new Logger(RevealBrokenHandUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('ICardService') private readonly cardService: ICardService,
  ) {}

  async prepare(
    request: RevealBrokenHandRequest,
  ): Promise<RevealBrokenHandPreparation> {
    try {
      const { roomId, socketId, playerId } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.id === socketId);

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

      state.blowState.declarations = [];
      state.blowState.currentHighestDeclaration = null;

      const firstBlowIndex = state.blowState.currentBlowIndex;
      const firstBlowPlayer = state.players[firstBlowIndex];

      state.currentPlayerIndex = firstBlowIndex;
      state.deck = this.cardService.generateDeck();
      await roomGameState.dealCards();

      const events: GatewayEvent[] = [];
      if (firstBlowPlayer) {
        events.push({
          scope: 'room',
          roomId,
          event: 'broken',
          payload: {
            nextPlayerId: firstBlowPlayer.playerId,
            players: state.players,
          },
        });
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: firstBlowPlayer.playerId,
        });
      }

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
