import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { CardPlayedPayload } from '@contracts/game';
import {
  IPlayCardUseCase,
  PlayCardRequest,
  PlayCardResponse,
  CompleteFieldTrigger,
  PlayCardGatewayEvent,
} from './interfaces/play-card.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import {
  resolvePlayerByActorId,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';
import { IPlayService } from '../services/interfaces/play-service.interface';
import { asSeatId } from '../types/identity.types';
import { resolveCurrentPlayer } from '../domain/current-turn';
import { toFieldContract } from '../adapters/game-contract-adapters';
import {
  createFieldCheckpoint,
  getFieldIntegrityError,
} from '../domain/field-recovery';

@Injectable()
export class PlayCardUseCase implements IPlayCardUseCase {
  private readonly logger = new Logger(PlayCardUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IPlayService') private readonly playService: IPlayService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
  ) {}

  async execute(request: PlayCardRequest): Promise<PlayCardResponse> {
    try {
      const { roomId, actorId, card } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const player = resolvePlayerByActorId(roomGameState, actorId);

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

      const currentField = state.playState.currentField;
      const fieldIntegrityError = getFieldIntegrityError(state, currentField);
      if (
        fieldIntegrityError ||
        currentField.playedBySeatIds.includes(player.seatId)
      ) {
        this.logger.error(
          `Recovering invalid field before card play in room ${roomId}: ${
            fieldIntegrityError ?? 'Current seat already played in this field'
          }`,
        );
        return {
          success: true,
          events: [],
          completeFieldTrigger: {
            roomId,
            delayMs: 0,
            field: {
              ...currentField,
              cards: [...currentField.cards],
              playedBySeatIds: [...currentField.playedBySeatIds],
            },
          },
        };
      }

      // Prevent playing on a field that is being completed
      if (state.playState.currentField.isComplete) {
        return {
          success: false,
          error: 'Current field is being completed, please wait',
        };
      }

      if (!roomGameState.isPlayerTurn(player.seatId)) {
        return { success: false, error: "It's not your turn to play" };
      }

      if (state.playState.currentField.cards.includes(card)) {
        return {
          success: false,
          error: 'Card already played on the field',
        };
      }

      const legalPlayError = this.playService.getCardPlayError(
        player.hand,
        state.playState.currentField,
        state.blowState?.currentTrump ?? null,
        card,
      );
      if (legalPlayError) {
        return { success: false, error: legalPlayError };
      }

      const room = await this.roomService.getRoom(roomId);

      if (currentField.cards.length === 0) {
        state.playState.fieldCheckpoint = createFieldCheckpoint(state);
      }

      // Remove the card from player's hand
      player.hand = player.hand.filter((c) => c !== card);

      const playedBySeatIds = [...currentField.playedBySeatIds];
      playedBySeatIds.push(asSeatId(player.seatId));
      currentField.cards.push(card);
      currentField.playedBySeatIds = [...playedBySeatIds];
      if (currentField.cards.length === 1) {
        currentField.baseCard = card;
      }

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'card_played',
        actorSeatId: asSeatId(player.seatId),
        state,
        actionData: {
          card,
          fieldCards: [...currentField.cards],
          baseCard: currentField.baseCard,
          playedBySeatIds: [...playedBySeatIds],
          isFieldComplete: currentField.cards.length === 4,
        },
      });

      const cardPlayedPayload: CardPlayedPayload = {
        seatId: asSeatId(player.seatId),
        card,
        field: toFieldContract(currentField),
        players: resolveTransportPlayers(roomGameState, state.players, {
          roomPlayers: room?.players,
        }),
      };
      const events: PlayCardGatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'card-played',
          payload: cardPlayedPayload,
        },
      ];

      if (currentField.cards.length === 4) {
        // Mark field as complete immediately to prevent 5th card
        currentField.isComplete = true;

        await roomGameState.saveState();
        const trigger: CompleteFieldTrigger = {
          roomId,
          delayMs: 3000,
          field: {
            ...currentField,
            cards: [...currentField.cards],
            playedBySeatIds: [...currentField.playedBySeatIds],
          },
        };
        return { success: true, events, completeFieldTrigger: trigger };
      }

      if (currentField.baseCard === 'JOKER' && !currentField.baseSuit) {
        await roomGameState.saveState();
        return { success: true, events };
      }

      roomGameState.nextTurn();
      const nextPlayer = resolveCurrentPlayer(state);
      if (nextPlayer) {
        cardPlayedPayload.nextSeatId = asSeatId(nextPlayer.seatId);
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: asSeatId(nextPlayer.seatId),
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
