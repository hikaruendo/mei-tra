import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  GameOverPayload,
  RoundCancelledPayload,
  RoundResultsPayload,
  UpdatePhasePayload,
} from '@contracts/game';
import type {
  FieldCompletePayload,
  NewRoundStartedPayload,
} from '@contracts/game';
import {
  ICompleteFieldUseCase,
  CompleteFieldRequest,
  CompleteFieldResponse,
  GameOverInstruction,
} from './interfaces/complete-field.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { IPlayService } from '../services/interfaces/play-service.interface';
import { IScoreService } from '../services/interfaces/score-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { Team, GameState, Field } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import { Room, RoomStatus } from '../types/room.types';
import {
  buildPlayerSyncEvents,
  resolveTransportPlayers,
} from './helpers/player-resolution.helper';
import {
  toBlowUpdatedPayload,
  toCompletedFieldContract,
  toFieldContract,
} from '../adapters/game-contract-adapters';
import { asSeatId } from '../types/identity.types';
import { setCurrentSeat } from '../domain/current-turn';
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
      const room = await this.roomService.getRoom(roomId);

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

      const declaringTeam = this.findDeclaringTeam(state);
      if (declaringTeam == null) {
        return {
          success: false,
          error: 'Declaring team could not be determined',
        };
      }

      this.applyPlayPoints(state, declaringTeam);
      await this.gameEventLogService?.log({
        roomId,
        actionType: 'round_completed',
        actorSeatId: state.blowState.currentHighestDeclaration?.seatId
          ? asSeatId(state.blowState.currentHighestDeclaration.seatId)
          : null,
        state,
        actionData: {
          declaringTeam,
          highestDeclaration: state.blowState.currentHighestDeclaration,
          teamScores: state.teamScores,
          completedFields: state.playState?.fields ?? [],
        },
      });

      const roundResultsPayload: RoundResultsPayload = {
        scores: state.teamScores,
      };

      events.push({
        scope: 'room',
        roomId,
        event: 'round-results',
        payload: roundResultsPayload,
      });

      const hasTeamReachedGoal = Object.values(state.teamScores).some(
        (score) => score.total >= state.pointsToWin,
      );

      if (hasTeamReachedGoal) {
        const winningTeamEntry = Object.entries(state.teamScores).find(
          ([, score]) => score.total >= state.pointsToWin,
        );
        const winningTeam = winningTeamEntry
          ? (Number(winningTeamEntry[0]) as Team)
          : declaringTeam;

        const gameOverPayload: GameOverPayload = {
          winner: `Team ${winningTeam}`,
          winningTeam,
          finalScores: state.teamScores,
        };

        events.push({
          scope: 'room',
          roomId,
          event: 'game-over',
          payload: gameOverPayload,
        });

        await this.gameEventLogService?.log({
          roomId,
          actionType: 'game_over',
          actorSeatId: null,
          state,
          actionData: {
            winningTeam,
            finalScores: state.teamScores,
          },
        });

        await this.roomService.updateRoomStatus(roomId, RoomStatus.FINISHED);
        await roomGameState.saveState();

        const gameOverInstruction: GameOverInstruction = {
          winningTeam,
          teamScores: state.teamScores,
          resetDelayMs: 5000,
        };

        response.gameOver = gameOverInstruction;
        return response;
      }

      const roundResetEvents = await this.prepareNextRound(
        roomId,
        roomGameState,
        state,
        room,
      );

      response.delayedEvents = roundResetEvents;

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
    const redealCount = (state.blowState.redealCount ?? 0) + 1;

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
        redealCount,
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

  private findDeclaringTeam(state: GameState): Team | null {
    const highestDeclaration = state.blowState.currentHighestDeclaration;
    if (!highestDeclaration) {
      return null;
    }

    if (highestDeclaration.team === 0 || highestDeclaration.team === 1) {
      return highestDeclaration.team;
    }

    const player = state.players.find(
      (p) => p.seatId === highestDeclaration.seatId,
    );
    if (player) {
      return player.team;
    }

    return null;
  }

  private applyPlayPoints(state: GameState, declaringTeam: Team) {
    const numberOfPairs =
      state.blowState.currentHighestDeclaration?.numberOfPairs || 0;
    const wonFields =
      state.playState?.fields.filter((f) => f.winnerTeam === declaringTeam)
        .length || 0;

    const playPoints = this.scoreService.calculatePlayPoints(
      numberOfPairs,
      wonFields,
    );

    if (playPoints >= 0) {
      state.teamScores[declaringTeam].play += playPoints;
      state.teamScores[declaringTeam].total += playPoints;
      state.teamScoreRecords[declaringTeam] = [
        ...state.teamScoreRecords[declaringTeam],
        {
          points: playPoints,
          timestamp: new Date(),
          reason: 'Play points',
        },
      ];
      return;
    }

    const opposingTeam = (1 - declaringTeam) as Team;
    const convertedPoints = Math.abs(playPoints);
    state.teamScores[opposingTeam].play += convertedPoints;
    state.teamScores[opposingTeam].total += convertedPoints;
    state.teamScoreRecords[opposingTeam] = [
      ...state.teamScoreRecords[opposingTeam],
      {
        points: convertedPoints,
        timestamp: new Date(),
        reason: 'Play points',
      },
    ];
  }

  private async prepareNextRound(
    roomId: string,
    roomGameState: GameStateService,
    state: GameState,
    room: Room | null,
  ): Promise<GatewayEvent[]> {
    roomGameState.resetRoundState();
    roomGameState.updateState({
      roundNumber: state.roundNumber + 1,
    });

    const updatedState = roomGameState.getState();
    const nextBlowIndex =
      (state.blowState.currentBlowIndex + 1) % state.players.length;
    const nextBlowPlayer =
      updatedState.players[nextBlowIndex] ?? updatedState.players[0];

    const newPlayState = {
      currentField: {
        cards: [],
        playedBySeatIds: [],
        baseCard: '',
        dealerSeatId: asSeatId(nextBlowPlayer.seatId),
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
    };

    const newBlowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      actionHistory: [],
      lastPasserSeatId: null,
      isRoundCancelled: false,
      currentBlowIndex: nextBlowIndex,
    };

    roomGameState.transitionPhase('blow');
    roomGameState.updateState({
      playState: newPlayState,
      blowState: newBlowState,
      currentSeatId: asSeatId(nextBlowPlayer.seatId),
    });

    const newRoundPayload: NewRoundStartedPayload = {
      players: resolveTransportPlayers(roomGameState, updatedState.players, {
        roomPlayers: room?.players,
      }),
      currentTurnSeatId: asSeatId(nextBlowPlayer.seatId),
      gamePhase: 'blow',
      currentField: null,
      completedFields: [],
      negriCard: null,
      negriSeatId: null,
      revealedAgari: null,
      currentTrump: null,
      currentHighestDeclaration: null,
      blowDeclarations: [],
    };

    const updatePhasePayload: UpdatePhasePayload = {
      phase: 'blow',
      scores: updatedState.teamScores,
      winner: nextBlowPlayer.team,
      currentTrump: null,
    };

    const delayedEvents: GatewayEvent[] = [
      {
        scope: 'room',
        roomId,
        event: 'round-reset',
        payload: undefined,
        delayMs: 3000,
      },
      {
        scope: 'room',
        roomId,
        event: 'new-round-started',
        payload: newRoundPayload,
        delayMs: 3000,
      },
      {
        scope: 'room',
        roomId,
        event: 'update-turn',
        payload: nextBlowPlayer.seatId,
        delayMs: 3000,
      },
      {
        scope: 'room',
        roomId,
        event: 'update-phase',
        payload: updatePhasePayload,
        delayMs: 3000,
      },
    ];

    await roomGameState.saveState();

    await this.gameEventLogService?.log({
      roomId,
      actionType: 'round_reset',
      actorSeatId: asSeatId(nextBlowPlayer.seatId),
      state: updatedState,
      actionData: {
        nextDealerSeatId: nextBlowPlayer.seatId,
        nextRoundNumber: updatedState.roundNumber,
        nextBlowIndex,
        startingHandsBySeatId: Object.fromEntries(
          updatedState.players.map((player) => [
            player.seatId,
            [...player.hand],
          ]),
        ),
      },
    });

    return delayedEvents;
  }
}
