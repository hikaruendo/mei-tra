import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ICompleteFieldUseCase,
  CompleteFieldRequest,
  CompleteFieldResponse,
  GameOverInstruction,
} from './interfaces/complete-field.use-case.interface';
import { IRoomService } from '../services/interfaces/room-service.interface';
import { IPlayService } from '../services/interfaces/play-service.interface';
import { IScoreService } from '../services/interfaces/score-service.interface';
import { GatewayEvent } from './interfaces/gateway-event.interface';
import { Team, GameState } from '../types/game.types';
import { GameStateService } from '../services/game-state.service';
import { RoomStatus } from '../types/room.types';

@Injectable()
export class CompleteFieldUseCase implements ICompleteFieldUseCase {
  private readonly logger = new Logger(CompleteFieldUseCase.name);

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IPlayService') private readonly playService: IPlayService,
    @Inject('IScoreService') private readonly scoreService: IScoreService,
  ) {}

  async execute(request: CompleteFieldRequest): Promise<CompleteFieldResponse> {
    try {
      const { roomId, field } = request;
      const roomGameState = await this.roomService.getRoomGameState(roomId);
      const state = roomGameState.getState();

      const winner = this.playService.determineFieldWinner(
        field,
        state.players,
        state.blowState.currentTrump,
      );

      if (!winner) {
        return { success: false, error: 'No winner determined for field' };
      }

      this.removeCardsFromHands(state, field.cards);

      const completedField = await roomGameState.completeField(
        field,
        winner.playerId,
      );

      if (!completedField) {
        return { success: false, error: 'Failed to persist completed field' };
      }

      const allHandsEmpty = state.players.every(
        (player) => player.hand.length === 0,
      );

      this.setNextDealer(state, winner.playerId);

      if (state.playState) {
        state.playState.currentField = {
          cards: [],
          baseCard: '',
          dealerId: winner.playerId,
          isComplete: false,
        };
      }

      const events: GatewayEvent[] = [
        {
          scope: 'room',
          roomId,
          event: 'field-complete',
          payload: {
            winnerId: winner.playerId,
            field: completedField,
            nextPlayerId: winner.playerId,
          },
        },
        {
          scope: 'room',
          roomId,
          event: 'update-players',
          payload: state.players,
        },
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
          payload: winner.playerId,
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
      events.push({
        scope: 'room',
        roomId,
        event: 'round-results',
        payload: {
          scores: state.teamScores,
        },
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

        events.push({
          scope: 'room',
          roomId,
          event: 'game-over',
          payload: {
            winner: `Team ${winningTeam}`,
            finalScores: state.teamScores,
          },
        });

        await this.roomService.updateRoomStatus(roomId, RoomStatus.FINISHED);
        await roomGameState.saveState();

        const gameOverInstruction: GameOverInstruction = {
          winningTeam,
          teamScores: state.teamScores,
          players: state.players,
          resetDelayMs: 5000,
        };

        response.gameOver = gameOverInstruction;
        return response;
      }

      const roundResetEvents = await this.prepareNextRound(
        roomId,
        roomGameState,
        state,
      );

      response.delayedEvents = roundResetEvents;
      await roomGameState.saveState();

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

  private setNextDealer(state: GameState, playerId: string) {
    const winnerIndex = state.players.findIndex(
      (player) => player.playerId === playerId,
    );
    if (winnerIndex !== -1) {
      state.currentPlayerIndex = winnerIndex;
    }
  }

  private findDeclaringTeam(state: GameState): Team | null {
    const highestDeclaration = state.blowState.currentHighestDeclaration;
    if (!highestDeclaration) {
      return null;
    }

    const player = state.players.find(
      (p) => p.playerId === highestDeclaration.playerId,
    );
    if (player) {
      return player.team;
    }

    if (state.teamAssignments) {
      const team = state.teamAssignments[highestDeclaration.playerId];
      if (typeof team === 'number') {
        return team;
      }
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
  ): Promise<GatewayEvent[]> {
    await roomGameState.resetRoundState();
    roomGameState.roundNumber = state.roundNumber + 1;

    const updatedState = roomGameState.getState();
    const nextBlowIndex =
      (state.blowState.currentBlowIndex + 1) % state.players.length;
    const nextBlowPlayer =
      updatedState.players[nextBlowIndex] ?? updatedState.players[0];

    const newPlayState = {
      currentField: {
        cards: [],
        baseCard: '',
        dealerId: nextBlowPlayer.playerId,
        isComplete: false,
      },
      negriCard: null,
      neguri: {},
      fields: [],
      lastWinnerId: null,
      openDeclared: false,
      openDeclarerId: null,
    };

    const newBlowState = {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      lastPasser: null,
      isRoundCancelled: false,
      currentBlowIndex: nextBlowIndex,
    };

    await roomGameState.updateState({
      gamePhase: 'blow',
      playState: newPlayState,
      blowState: newBlowState,
      currentPlayerIndex: nextBlowIndex,
    });

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
        payload: {
          players: updatedState.players,
          currentTurn: nextBlowPlayer.playerId,
          gamePhase: 'blow',
          currentField: null,
          completedFields: [],
          negriCard: null,
          negriPlayerId: null,
          revealedAgari: null,
          currentTrump: null,
          currentHighestDeclaration: null,
          blowDeclarations: [],
        },
        delayMs: 3000,
      },
      {
        scope: 'room',
        roomId,
        event: 'update-turn',
        payload: nextBlowPlayer.playerId,
        delayMs: 3000,
      },
      {
        scope: 'room',
        roomId,
        event: 'update-phase',
        payload: {
          phase: 'blow',
          scores: updatedState.teamScores,
          winner: nextBlowPlayer.team,
          currentTrump: null,
        },
        delayMs: 3000,
      },
    ];

    return delayedEvents;
  }
}
