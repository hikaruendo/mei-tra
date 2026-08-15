import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  GameOverPayload,
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
import { toCompletedFieldContract } from '../adapters/game-contract-adapters';
import { asSeatId, type SeatId } from '../types/identity.types';
import { setCurrentSeat } from '../domain/current-turn';

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
      const { roomId, field } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();

      const fieldValidationError = this.validateFieldAttribution(state, field);
      if (fieldValidationError) {
        return { success: false, error: fieldValidationError };
      }

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

  private validateFieldAttribution(
    state: GameState,
    field: Field,
  ): string | null {
    if (field.cards.length !== field.playedBySeatIds.length) {
      return 'Field card/player attribution mismatch';
    }

    if (field.cards.length !== 4) {
      return 'Field is not complete';
    }

    const seatIds = new Set<SeatId>(
      state.players.map((player) => player.seatId),
    );
    if (field.playedBySeatIds.some((seatId) => !seatIds.has(seatId))) {
      return 'Field contains unknown player attribution';
    }

    if (new Set(field.playedBySeatIds).size !== field.playedBySeatIds.length) {
      return 'Field contains duplicate player attribution';
    }

    const currentField = state.playState?.currentField;
    if (currentField && currentField.cards.length > 0) {
      const isSameField =
        this.isSameSequence(currentField.cards, field.cards) &&
        this.isSameSequence(
          currentField.playedBySeatIds,
          field.playedBySeatIds,
        ) &&
        currentField.dealerSeatId === field.dealerSeatId &&
        currentField.baseCard === field.baseCard &&
        currentField.baseSuit === field.baseSuit;

      if (!isSameField) {
        return 'Field completion request is stale or mismatched';
      }
    }

    return null;
  }

  private isSameSequence(left: string[], right: string[]): boolean {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
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
