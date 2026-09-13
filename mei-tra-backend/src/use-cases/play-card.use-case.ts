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
import { getCurrentFieldIdentity } from '../domain/field-recovery';
import { IChomboService } from '../services/interfaces/chombo-service.interface';

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
        const alreadyRecorded = state.playState.chomboViolations?.some(
          (candidate) =>
            candidate.violatorSeatId === winnerSeatId &&
            candidate.type === 'negri-forget' &&
            !candidate.isExpired &&
            !candidate.reportedBySeatId,
        );
        if (winner && !alreadyRecorded) {
          const violation = this.chomboService?.recordViolation(
            winnerSeatId,
            'negri-forget',
          );
          if (violation) {
            state.playState.chomboViolations = [
              ...(state.playState.chomboViolations ?? []),
              violation,
            ];
          }
        }
      }

      if (room?.settings.gameMode === 'pro' && !player.isCOM) {
        const lastTanzenViolation = this.chomboService?.checkViolations(
          asSeatId(player.seatId),
          'check-last-card',
          { player },
        );
        if (
          lastTanzenViolation &&
          !(state.playState.chomboViolations ?? []).some(
            (candidate) =>
              candidate.violatorSeatId === lastTanzenViolation.violatorSeatId &&
              candidate.type === lastTanzenViolation.type &&
              !candidate.isExpired &&
              !candidate.reportedBySeatId,
          )
        ) {
          state.playState.chomboViolations = [
            ...(state.playState.chomboViolations ?? []),
            lastTanzenViolation,
          ];
        }
      }

      if (room?.settings.gameMode === 'pro' && !player.isCOM) {
        const fourJackViolation = this.chomboService?.checkViolations(
          asSeatId(player.seatId),
          'check-four-jack',
          { player, hasBroken: player.hasBroken },
        );
        if (
          fourJackViolation &&
          !(state.playState.chomboViolations ?? []).some(
            (candidate) =>
              candidate.violatorSeatId === fourJackViolation.violatorSeatId &&
              candidate.type === fourJackViolation.type &&
              !candidate.isExpired &&
              !candidate.reportedBySeatId,
          )
        ) {
          state.playState.chomboViolations = [
            ...(state.playState.chomboViolations ?? []),
            fourJackViolation,
          ];
        }
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

      // Remove the card from player's hand
      player.hand = player.hand.filter((c) => c !== card);

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

        await roomGameState.saveState();
        const trigger: CompleteFieldTrigger = {
          roomId,
          delayMs: 3000,
          fieldIdentity: getCurrentFieldIdentity(state) ?? {
            roundNumber: state.roundNumber,
            fieldIndex: state.playState.fields.length,
            attemptId: `legacy:${state.roundNumber}:${state.playState.fields.length}`,
          },
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
