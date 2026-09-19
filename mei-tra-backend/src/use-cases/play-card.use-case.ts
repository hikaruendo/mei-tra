import {
  appendChomboCandidate,
  isLastTanzenAwaitingReport,
} from '../domain/chombo-candidates';
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
  getCurrentFieldIdentity,
  getFieldIntegrityError,
} from '../domain/field-recovery';
import { IChomboService } from '../services/interfaces/chombo-service.interface';

/** How long a full field stays on the table before it is collected. */
const FIELD_COMPLETE_DELAY_MS = 3000;
/**
 * A last tanzen shows only when its Joker lands in the round's last field, and
 * collecting that field ends the round and its reports. Holding the field
 * longer gives the other team time to report it.
 */
const LAST_TANZEN_REPORT_HOLD_MS = 10_000;

@Injectable()
export class PlayCardUseCase implements IPlayCardUseCase {
  private readonly logger = new Logger(PlayCardUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IPlayService') private readonly playService: IPlayService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
    @Optional()
    @Inject('IChomboService')
    private readonly chomboService?: IChomboService,
  ) {}

  async execute(request: PlayCardRequest): Promise<PlayCardResponse> {
    try {
      const { roomId, actorId, card } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      // A chombo report can end the game in the middle of a trick, leaving the
      // turn with whoever was about to play.
      if (state.gameOver) {
        return { success: false, error: 'The game is already over' };
      }

      const room = await this.roomService.getRoom(roomId);
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

      if (!roomGameState.isPlayerTurn(player.seatId)) {
        return { success: false, error: "It's not your turn to play" };
      }

      if (state.playState?.openResolved) {
        return { success: false, error: 'Play is settled after a valid open' };
      }

      if (!state.playState) {
        return {
          success: false,
          error: 'Play state is unavailable',
        };
      }

      const integrityField = state.playState.currentField;
      if (integrityField) {
        const fieldIntegrityError = getFieldIntegrityError(
          state,
          integrityField,
        );
        if (
          fieldIntegrityError ||
          integrityField.playedBySeatIds.includes(player.seatId)
        ) {
          const fieldIdentity = getCurrentFieldIdentity(state);
          this.logger.error(
            `Recovering invalid field before card play in room ${roomId}: ${fieldIntegrityError ?? 'Current seat already played in this field'}`,
          );
          return fieldIdentity
            ? {
                success: true,
                events: [],
                completeFieldTrigger: {
                  roomId,
                  delayMs: 0,
                  fieldIdentity,
                  field: {
                    ...integrityField,
                    cards: [...integrityField.cards],
                    playedBySeatIds: [...integrityField.playedBySeatIds],
                  },
                },
              }
            : { success: false, error: 'Field identity is unavailable' };
        }
      }

      // Pro mode allows the declaration winner to skip Negri and play first.
      // Create the empty field lazily for that flow only.
      if (!state.playState.currentField) {
        if (room?.settings.gameMode !== 'pro') {
          return {
            success: false,
            error: 'Game state error: No current field',
          };
        }
        state.playState.currentField = {
          cards: [],
          playedBySeatIds: [],
          baseCard: '',
          dealerSeatId: asSeatId(player.seatId),
          isComplete: false,
        };
      }

      if (room?.settings.gameMode === 'pro') {
        state.playState.chomboRoundNumber ??= state.roundNumber;
      }

      if (!state.playState.currentField) {
        return { success: false, error: 'Play field is unavailable' };
      }

      // Prevent playing on a field that is being completed
      if (state.playState.currentField.isComplete) {
        return {
          success: false,
          error: 'Current field is being completed, please wait',
        };
      }

      if (state.playState.currentField.cards.includes(card)) {
        return {
          success: false,
          error: 'Card already played on the field',
        };
      }

      if (
        room?.settings.gameMode === 'pro' &&
        !state.players.find(
          (candidate) =>
            candidate.seatId ===
            state.blowState.currentHighestDeclaration?.seatId,
        )?.isCOM &&
        !state.playState.negriCard &&
        state.playState.fields.length === 0 &&
        state.playState.currentField.cards.length === 0 &&
        state.blowState.currentHighestDeclaration?.seatId
      ) {
        const winnerSeatId = asSeatId(
          state.blowState.currentHighestDeclaration.seatId,
        );
        const winner = state.players.find(
          (candidate) => candidate.seatId === winnerSeatId,
        );
        if (winner) {
          state.playState.chomboViolations = appendChomboCandidate(
            state.playState.chomboViolations ?? [],
            this.chomboService?.recordViolation(winnerSeatId, 'negri-forget'),
          );
        }
      }

      if (room?.settings.gameMode === 'pro' && !player.isCOM) {
        const fourJackViolation = this.chomboService?.checkViolations(
          asSeatId(player.seatId),
          'check-four-jack',
          { player, hasBroken: player.hasBroken },
        );
        state.playState.chomboViolations = appendChomboCandidate(
          state.playState.chomboViolations ?? [],
          fourJackViolation,
        );
      }

      const legalPlayError = this.playService.getCardPlayError(
        player.hand,
        state.playState.currentField,
        state.blowState?.currentTrump ?? null,
        card,
      );
      if (
        room?.settings.gameMode === 'pro' &&
        !player.isCOM &&
        legalPlayError
      ) {
        const violation = this.chomboService?.checkViolations(
          asSeatId(player.seatId),
          'play-card',
          {
            player,
            field: state.playState.currentField,
            card,
            trump: state.blowState?.currentTrump ?? null,
          },
        );
        if (violation) {
          state.playState.chomboViolations = [
            ...(state.playState.chomboViolations ?? []),
            violation,
          ];
        }
      }
      if (legalPlayError && room?.settings.gameMode !== 'pro') {
        return { success: false, error: legalPlayError };
      }

      if (state.playState.currentField.cards.length === 0) {
        state.playState.fieldCheckpoint = createFieldCheckpoint(state);
      }

      // Remove the card from player's hand
      player.hand = player.hand.filter((c) => c !== card);
      const revealedHand = state.playState.revealedHands?.[player.seatId];
      if (revealedHand) {
        state.playState.revealedHands = {
          ...state.playState.revealedHands,
          [player.seatId]: revealedHand.filter((c) => c !== card),
        };
      }

      // A hand left with only the Joker missed the tanzen, and is reportable
      // from this moment on.
      if (room?.settings.gameMode === 'pro' && !player.isCOM) {
        state.playState.chomboViolations = appendChomboCandidate(
          state.playState.chomboViolations ?? [],
          this.chomboService?.checkViolations(
            asSeatId(player.seatId),
            'check-last-card',
            { player },
          ),
        );
      }

      const currentField = state.playState.currentField;
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

        const activeFieldIdentity = getCurrentFieldIdentity(state);
        await roomGameState.saveState();
        if (!activeFieldIdentity) {
          return { success: false, error: 'Field identity is unavailable' };
        }
        const trigger: CompleteFieldTrigger = {
          roomId,
          delayMs:
            room?.settings.gameMode === 'pro' &&
            isLastTanzenAwaitingReport(state)
              ? LAST_TANZEN_REPORT_HOLD_MS
              : FIELD_COMPLETE_DELAY_MS,
          fieldIdentity: activeFieldIdentity,
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
