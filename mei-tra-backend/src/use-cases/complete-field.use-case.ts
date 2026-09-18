import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  FieldCompletePayload,
  RoundCancelledPayload,
} from '@contracts/game';
import {
  ICompleteFieldUseCase,
  CompleteFieldRequest,
  CompleteFieldResponse,
} from './interfaces/complete-field.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { IPlayService } from '../services/interfaces/play-service.interface';
import { IScoreService } from '../services/interfaces/score-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { GameState, Field } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import {
  buildPlayerSyncEvents,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';
import { completeRound } from './helpers/round-completion.helper';
import {
  toBlowUpdatedPayload,
  toCompletedFieldContract,
  toFieldContract,
} from '../adapters/game-contract-adapters';
import { asSeatId } from '../types/identity.types';
import { setCurrentSeat } from '../domain/current-turn';
import { IChomboService } from '../services/interfaces/chombo-service.interface';
import {
  getCurrentFieldIdentity,
  getFieldIntegrityError,
  isSameFieldIdentity,
  restoreFieldCheckpoint,
} from '../domain/field-recovery';

@Injectable()
export class CompleteFieldUseCase implements ICompleteFieldUseCase {
  private readonly logger = new Logger(CompleteFieldUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IPlayService') private readonly playService: IPlayService,
    @Inject('IScoreService') private readonly scoreService: IScoreService,
    @Optional()
    @Inject('IGameEventLogService')
    private readonly gameEventLogService?: IGameEventLogService,
    @Optional()
    @Inject('IChomboService')
    private readonly chomboService?: IChomboService,
  ) {}

  async execute(request: CompleteFieldRequest): Promise<CompleteFieldResponse> {
    try {
      const { roomId, field: requestedField } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();
      const currentField = state.playState?.currentField;

      if (!currentField) {
        return { success: true, events: [] };
      }

      if (currentField.cards.length === 0) {
        const requestRepresentsThisFieldCompletion =
          requestedField.isComplete &&
          requestedField.cards.length === state.players.length &&
          isSameFieldIdentity(
            request.fieldIdentity,
            getCurrentFieldIdentity(state),
          );
        return requestRepresentsThisFieldCompletion
          ? this.recoverInvalidField(
              roomId,
              roomGameState,
              state,
              'Scheduled field completion lost every play in the current field',
            )
          : { success: true, events: [] };
      }

      const fieldValidationError = getFieldIntegrityError(state, currentField);
      if (fieldValidationError) {
        return this.recoverInvalidField(
          roomId,
          roomGameState,
          state,
          fieldValidationError,
        );
      }

      const completionDoesNotMatchCurrentState =
        !currentField.isComplete ||
        currentField.cards.length !== state.players.length ||
        !this.isSameField(currentField, requestedField);
      if (completionDoesNotMatchCurrentState) {
        const currentFieldIdentity = getCurrentFieldIdentity(state);
        const requestRepresentsThisFieldCompletion =
          requestedField.isComplete &&
          requestedField.cards.length === state.players.length &&
          isSameFieldIdentity(request.fieldIdentity, currentFieldIdentity);
        if (requestRepresentsThisFieldCompletion) {
          return this.recoverInvalidField(
            roomId,
            roomGameState,
            state,
            'Scheduled field completion no longer matches the current field',
          );
        }
        return { success: true, events: [] };
      }

      const field = currentField;

      const winner = this.playService.determineFieldWinner(
        field,
        state.players,
        state.blowState.currentTrump,
      );

      if (!winner) {
        return { success: false, error: 'No winner determined for field' };
      }

      this.removeCardsFromHands(state, field.cards);

      const completedField = roomGameState.completeField(field, winner.seatId);

      if (!completedField) {
        return { success: false, error: 'Failed to persist completed field' };
      }

      await this.gameEventLogService?.log({
        roomId,
        actionType: 'field_completed',
        actorSeatId: asSeatId(winner.seatId),
        state,
        actionData: {
          completedField,
          winnerSeatId: winner.seatId,
          winnerTeam: winner.team,
          cards: [...field.cards],
        },
      });

      const room = await this.roomService.getRoom(roomId);
      if (room?.settings.gameMode === 'pro') {
        this.setAsideUnplacedNegri(state);
      }

      const allHandsEmpty = state.players.every(
        (player) => player.hand.length === 0,
      );

      setCurrentSeat(state, winner.seatId);

      if (state.playState) {
        state.playState.currentField = {
          cards: [],
          playedBySeatIds: [],
          baseCard: '',
          dealerSeatId: asSeatId(winner.seatId),
          isComplete: false,
        };
        state.playState.fieldCheckpoint = null;
      }

      const fieldCompletePayload: FieldCompletePayload = {
        winnerSeatId: asSeatId(winner.seatId),
        field: toCompletedFieldContract(completedField),
        nextSeatId: asSeatId(winner.seatId),
      };

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'field-complete',
          payload: fieldCompletePayload,
        },
        ...buildPlayerSyncEvents(roomGameState, roomId, state.players, {
          room,
        }),
      ];

      const response: CompleteFieldResponse = {
        success: true,
        events,
      };

      if (!allHandsEmpty) {
        events.push({
          scope: 'room',
          roomId,
          event: 'update-turn',
          payload: winner.seatId,
        });

        await roomGameState.saveState();
        return response;
      }

      const completion = await completeRound({
        roomId,
        roomGameState,
        state,
        room,
        roomService: this.roomService,
        scoreService: this.scoreService,
        gameEventLogService: this.gameEventLogService,
      });
      if (!completion) {
        return {
          success: false,
          error: 'Declaring team could not be determined',
        };
      }

      events.push(...completion.events);
      response.delayedEvents = completion.delayedEvents;
      response.gameOver = completion.gameOver;

      return response;
    } catch (error) {
      this.logger.error(
        'Unexpected error in CompleteFieldUseCase',
        error instanceof Error ? error.stack : String(error),
      );
      return { success: false, error: 'Internal server error' };
    }
  }

  private removeCardsFromHands(state: GameState, cards: string[]) {
    state.players.forEach((player) => {
      player.hand = player.hand.filter((card) => !cards.includes(card));
    });
  }

  // Pro mode lets the declaration winner play on without placing the Negri.
  // When the last field empties every other hand, the one card they still
  // hold is that Negri, so it is set aside here and the round can end.
  private setAsideUnplacedNegri(state: GameState) {
    const playState = state.playState;
    const declarerSeatId = state.blowState.currentHighestDeclaration?.seatId;
    if (!playState || playState.negriCard || !declarerSeatId) {
      return;
    }

    const declarer = state.players.find(
      (player) => player.seatId === declarerSeatId,
    );
    const onlyTheNegriIsLeft =
      declarer?.hand.length === 1 &&
      state.players.every(
        (player) => player === declarer || player.hand.length === 0,
      );
    if (!declarer || !onlyTheNegriIsLeft) {
      return;
    }

    playState.negriCard = declarer.hand[0];
    playState.negriSeatId = asSeatId(declarer.seatId);
    declarer.hand = [];
  }

  private isSameField(left: Field, right: Field): boolean {
    return (
      this.isSameSequence(left.cards, right.cards) &&
      this.isSameSequence(left.playedBySeatIds, right.playedBySeatIds) &&
      left.dealerSeatId === right.dealerSeatId &&
      left.baseCard === right.baseCard &&
      left.baseSuit === right.baseSuit
    );
  }

  private isSameSequence(left: string[], right: string[]): boolean {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }

  private async recoverInvalidField(
    roomId: string,
    roomGameState: GameStateService,
    state: GameState,
    reason: string,
  ): Promise<CompleteFieldResponse> {
    this.logger.error(`Recovering invalid field in room ${roomId}: ${reason}`);
    const fieldIdentity = getCurrentFieldIdentity(state);
    const abandonedCards = [...(state.playState?.currentField?.cards ?? [])];
    const abandonedPlayedBySeatIds = [
      ...(state.playState?.currentField?.playedBySeatIds ?? []),
    ];

    if (restoreFieldCheckpoint(state)) {
      await roomGameState.saveState();
      await this.gameEventLogService?.log({
        roomId,
        actionType: 'field_recovered',
        state,
        actionData: {
          reason,
          fieldIndex: fieldIdentity?.fieldIndex ?? null,
          fieldAttemptId: fieldIdentity?.attemptId ?? null,
          abandonedCards,
          abandonedPlayedBySeatIds,
        },
      });
      const room = await this.roomService.getRoom(roomId);
      const restoredField = state.playState?.currentField;
      const currentSeatId = state.currentSeatId;
      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'field-recovered',
          payload: undefined,
        },
        ...(restoredField
          ? [
              {
                scope: 'room' as const,
                roomId,
                event: 'field-updated',
                payload: toFieldContract(restoredField),
              },
            ]
          : []),
        ...buildPlayerSyncEvents(roomGameState, roomId, state.players, {
          room,
        }),
        ...(currentSeatId
          ? [
              {
                scope: 'room' as const,
                roomId,
                event: 'update-turn',
                payload: currentSeatId,
              },
            ]
          : []),
      ];
      return { success: true, events };
    }

    return this.redealCurrentRound(roomId, roomGameState, state, reason);
  }

  private async redealCurrentRound(
    roomId: string,
    roomGameState: GameStateService,
    state: GameState,
    recoveryReason: string,
  ): Promise<CompleteFieldResponse> {
    const roundNumber = state.roundNumber;
    const playerCount = state.players.length;
    const firstBlowIndex =
      playerCount > 0 ? state.blowState.currentBlowIndex % playerCount : 0;

    roomGameState.resetRoundState();
    const resetState = roomGameState.getState();
    const firstBlowPlayer =
      resetState.players[firstBlowIndex] ?? resetState.players[0];
    if (!firstBlowPlayer) {
      return { success: false, error: 'Cannot recover a game without players' };
    }

    roomGameState.transitionPhase('blow');
    roomGameState.updateState({
      roundNumber,
      currentSeatId: asSeatId(firstBlowPlayer.seatId),
      blowState: {
        currentTrump: null,
        currentHighestDeclaration: null,
        declarations: [],
        actionHistory: [],
        lastPasserSeatId: null,
        isRoundCancelled: false,
        currentBlowIndex: firstBlowIndex,
      },
      playState: {
        currentField: {
          cards: [],
          playedBySeatIds: [],
          baseCard: '',
          dealerSeatId: asSeatId(firstBlowPlayer.seatId),
          isComplete: false,
        },
        negriCard: null,
        negriSeatId: null,
        neguri: {},
        fields: [],
        lastWinnerSeatId: null,
        openDeclared: false,
        openDeclarerSeatId: null,
        fieldCheckpoint: null,
      },
    });

    await roomGameState.saveState();
    const recoveredState = roomGameState.getState();
    const room = await this.roomService.getRoom(roomId);
    const roundCancelledPayload: RoundCancelledPayload = {
      nextDealerSeatId: asSeatId(firstBlowPlayer.seatId),
      players: resolveTransportPlayers(roomGameState, recoveredState.players, {
        roomPlayers: room?.players,
      }),
      reason: 'field-recovery',
      currentTrump: null,
      currentHighestDeclaration: null,
      blowDeclarations: [],
      actionHistory: [],
    };

    await this.gameEventLogService?.log({
      roomId,
      actionType: 'round_cancelled',
      actorSeatId: null,
      state: recoveredState,
      actionData: {
        reason: 'field_recovery',
        recoveryReason,
        nextDealerSeatId: firstBlowPlayer.seatId,
        nextBlowIndex: firstBlowIndex,
      },
    });

    return {
      success: true,
      events: [
        ...buildPlayerSyncEvents(
          roomGameState,
          roomId,
          recoveredState.players,
          { room },
        ),
        {
          scope: 'room',
          roomId,
          event: 'blow-updated',
          payload: toBlowUpdatedPayload(recoveredState.blowState),
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
          payload: asSeatId(firstBlowPlayer.seatId),
        },
      ],
    };
  }
}
