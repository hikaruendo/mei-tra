import type {
  GameOverPayload,
  NewRoundStartedPayload,
  RoundResultsPayload,
  UpdatePhasePayload,
} from '@contracts/game';
import { GameStateService } from '../../services/game-state.service';
import { IGameEventLogService } from '../../services/interfaces/game-event-log.service.interface';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IScoreService } from '../../services/interfaces/score-service.interface';
import { GameState, Team } from '../../types/game.types';
import { asSeatId } from '../../types/identity.types';
import { Room, RoomStatus } from '../../types/room.types';
import { GameOverInstruction } from '../interfaces/complete-field.use-case.interface';
import { GatewayEvent } from '../interfaces/gateway-event.interface';
import { resolveTransportPlayers } from './player-resolution.helper';

export interface RoundCompletion {
  events: GatewayEvent[];
  delayedEvents?: GatewayEvent[];
  gameOver?: GameOverInstruction;
}

interface CompleteRoundParams {
  roomId: string;
  roomGameState: GameStateService;
  state: GameState;
  room: Room | null;
  roomService: IRoomService;
  scoreService: IScoreService;
  gameEventLogService?: IGameEventLogService;
  /** Set when a valid open ends the round: every unplayed field goes to this team. */
  remainingFieldsWinnerTeam?: Team;
}

/**
 * Scores the round for the declaring team, then either ends the game or deals
 * the next round. Returns null when the declaring team cannot be determined.
 */
export async function completeRound({
  roomId,
  roomGameState,
  state,
  room,
  roomService,
  scoreService,
  gameEventLogService,
  remainingFieldsWinnerTeam,
}: CompleteRoundParams): Promise<RoundCompletion | null> {
  const declaringTeam = findDeclaringTeam(state);
  if (declaringTeam == null) {
    return null;
  }

  const unplayedWonFields =
    remainingFieldsWinnerTeam === declaringTeam
      ? countRemainingFields(state)
      : 0;
  applyPlayPoints(
    state,
    declaringTeam,
    countWonFields(state, declaringTeam) + unplayedWonFields,
    scoreService,
  );
  await gameEventLogService?.log({
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
  const events: GatewayEvent[] = [
    {
      scope: 'room',
      roomId,
      event: 'round-results',
      payload: roundResultsPayload,
    },
  ];

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
    state.gameOver = {
      ...gameOverPayload,
      finalScores: state.teamScores,
    };

    events.push({
      scope: 'room',
      roomId,
      event: 'game-over',
      payload: gameOverPayload,
    });

    await gameEventLogService?.log({
      roomId,
      actionType: 'game_over',
      actorSeatId: null,
      state,
      actionData: {
        winningTeam,
        finalScores: state.teamScores,
      },
    });

    await roomService.updateRoomStatus(roomId, RoomStatus.FINISHED);
    await roomGameState.saveState();

    return {
      events,
      gameOver: {
        winningTeam,
        teamScores: state.teamScores,
        resetDelayMs: 5000,
      },
    };
  }

  return {
    events,
    delayedEvents: await prepareNextRound(
      roomId,
      roomGameState,
      state,
      room,
      gameEventLogService,
    ),
  };
}

function findDeclaringTeam(state: GameState): Team | null {
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

function countWonFields(state: GameState, team: Team): number {
  return (
    state.playState?.fields.filter((field) => field.winnerTeam === team)
      .length || 0
  );
}

// A seat that already played into the current field holds one card fewer than
// the fields it still takes part in.
function countRemainingFields(state: GameState): number {
  const playedBySeatIds = state.playState?.currentField?.playedBySeatIds ?? [];
  return Math.max(
    0,
    ...state.players.map(
      (player) =>
        player.hand.length + (playedBySeatIds.includes(player.seatId) ? 1 : 0),
    ),
  );
}

function applyPlayPoints(
  state: GameState,
  declaringTeam: Team,
  wonFields: number,
  scoreService: IScoreService,
) {
  const numberOfPairs =
    state.blowState.currentHighestDeclaration?.numberOfPairs || 0;

  const playPoints = scoreService.calculatePlayPoints(numberOfPairs, wonFields);

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

async function prepareNextRound(
  roomId: string,
  roomGameState: GameStateService,
  state: GameState,
  room: Room | null,
  gameEventLogService?: IGameEventLogService,
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

  await gameEventLogService?.log({
    roomId,
    actionType: 'round_reset',
    actorSeatId: asSeatId(nextBlowPlayer.seatId),
    state: updatedState,
    actionData: {
      nextDealerSeatId: nextBlowPlayer.seatId,
      nextRoundNumber: updatedState.roundNumber,
      nextBlowIndex,
      startingHandsBySeatId: Object.fromEntries(
        updatedState.players.map((player) => [player.seatId, [...player.hand]]),
      ),
    },
  });

  return delayedEvents;
}
