import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
import { ICardService } from '../services/interfaces/card-service.interface';
import { Field, TrumpType } from '../types/game.types';

@Injectable()
export class PlayCardUseCase implements IPlayCardUseCase {
  private readonly logger = new Logger(PlayCardUseCase.name);
  private readonly trumpToSuit: Record<TrumpType, string> = {
    tra: '',
    herz: '♥',
    daiya: '♦',
    club: '♣',
    zuppe: '♠',
  };

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('ICardService') private readonly cardService: ICardService,
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

      // Prevent playing on a field that is being completed
      if (state.playState.currentField.isComplete) {
        return {
          success: false,
          error: 'Current field is being completed, please wait',
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

      const legalPlayError = this.getLegalPlayError(
        player.hand,
        state.playState.currentField,
        state.blowState?.currentTrump ?? null,
        card,
      );
      if (legalPlayError) {
        return { success: false, error: legalPlayError };
      }

      // Remove the card from player's hand
      player.hand = player.hand.filter((c) => c !== card);

      const currentField = state.playState.currentField;
      const playedBy = Array.isArray(currentField.playedBy)
        ? currentField.playedBy
        : [];
      currentField.playedBy = playedBy;
      currentField.cards.push(card);
      playedBy.push(player.playerId);
      if (currentField.cards.length === 1) {
        currentField.baseCard = card;
      }

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'card_played',
        playerId: player.playerId,
        state,
        actionData: {
          card,
          fieldCards: [...currentField.cards],
          baseCard: currentField.baseCard,
          playedBy: [...playedBy],
          isFieldComplete: currentField.cards.length === 4,
        },
      });

      const events: PlayCardGatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'card-played',
          payload: {
            playerId: player.playerId,
            card,
            field: currentField,
            players: resolveTransportPlayers(roomGameState, state.players),
          },
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

  private getLegalPlayError(
    hand: string[],
    currentField: Field,
    currentTrump: TrumpType | null,
    card: string,
  ): string | null {
    if (hand.length === 2 && hand.includes('JOKER') && card !== 'JOKER') {
      return 'In Tanzen round, you must play the Joker if you have it.';
    }

    if (card === 'JOKER') {
      return null;
    }

    if (!currentField.cards.length || !currentField.baseCard) {
      return null;
    }

    const baseSuit =
      currentField.baseCard === 'JOKER'
        ? currentField.baseSuit
        : this.cardService.getCardSuit(
            currentField.baseCard,
            currentTrump,
            currentField.baseSuit,
          );

    if (!baseSuit) {
      return null;
    }

    const cardSuit = this.cardService.getCardSuit(card, currentTrump, baseSuit);
    const hasBaseSuit = hand.some(
      (handCard) =>
        handCard !== 'JOKER' &&
        this.cardService.getCardSuit(handCard, currentTrump, baseSuit) ===
          baseSuit,
    );

    if (cardSuit !== baseSuit && hasBaseSuit) {
      return `You must play a card of suit ${baseSuit}.`;
    }

    const trumpSuit = currentTrump ? this.trumpToSuit[currentTrump] : '';
    const hasNonJokerTrump = hand.some(
      (handCard) =>
        handCard !== 'JOKER' &&
        this.cardService.getCardSuit(handCard, currentTrump, baseSuit) ===
          trumpSuit,
    );

    if (baseSuit === trumpSuit && hand.includes('JOKER') && !hasNonJokerTrump) {
      return `You must play the Joker since you have no ${trumpSuit} cards.`;
    }

    return null;
  }
}
