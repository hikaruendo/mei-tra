import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IPlayCardUseCase,
  PlayCardRequest,
  PlayCardResponse,
  CompleteFieldTrigger,
} from './interfaces/play-card.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';

@Injectable()
export class PlayCardUseCase implements IPlayCardUseCase {
  private readonly logger = new Logger(PlayCardUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: PlayCardRequest): Promise<PlayCardResponse> {
    try {
      const { roomId, socketId, card } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = state.players.find((p) => p.id === socketId);

      if (!player) {
        return { success: false, error: 'Player not found in game state' };
      }

      if (!player.hand.includes(card)) {
        return {
          success: false,
          error: 'Card already played or invalid',
        };
      }

      if (!state.playState?.currentField) {
        return {
          success: false,
          error: 'Game state error: No current field',
        };
      }

      if (!roomGameState.isPlayerTurn(player.playerId)) {
        return { success: false, error: "It's not your turn to play" };
      }

      if (state.playState.currentField.cards.includes(card)) {
        return {
          success: false,
          error: 'Card already played on the field',
        };
      }

      // Remove the card from player's hand
      player.hand = player.hand.filter((c) => c !== card);

      const currentField = state.playState.currentField;
      currentField.cards.push(card);
      if (currentField.cards.length === 1) {
        currentField.baseCard = card;
      }

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'card-played',
          payload: {
            playerId: player.playerId,
            card,
            field: currentField,
            players: state.players,
          },
        },
      ];

      if (currentField.cards.length === 4) {
        await roomGameState.saveState();
        const trigger: CompleteFieldTrigger = {
          roomId,
          delayMs: 3000,
          field: {
            ...currentField,
            cards: [...currentField.cards],
          },
        };
        return { success: true, events, completeFieldTrigger: trigger };
      }

      if (currentField.baseCard === 'JOKER' && !currentField.baseSuit) {
        await roomGameState.saveState();
        return { success: true, events };
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

      await roomGameState.saveState();
      return { success: true, events };
    } catch (error) {
      this.logger.error(
        'Unexpected error in PlayCardUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }
}
