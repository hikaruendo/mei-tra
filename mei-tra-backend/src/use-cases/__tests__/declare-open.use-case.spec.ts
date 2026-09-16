import { OPEN_MAX_HAND_SIZE } from '@contracts/game';
import { DeclareOpenUseCase } from '../declare-open.use-case';
import { ScoreService } from '../../services/score.service';
import { asSeatId } from '../../types/identity.types';
import type {
  CompletedField,
  DomainPlayer,
  GameState,
  Team,
} from '../../types/game.types';
import { RoomStatus } from '../../types/room.types';
import { createGame } from './chombo-game.fixture';

const seat = (seatId: string, team: Team, hand: string[]): DomainPlayer => ({
  seatId: asSeatId(seatId),
  name: seatId,
  team,
  hand,
  isPasser: false,
});

const players: DomainPlayer[] = [
  seat('declarer', 0, ['A♠']),
  seat('partner', 0, ['K♠']),
  seat('opponent', 1, ['Q♥']),
  seat('opponent-2', 1, ['J♥']),
];

const state: GameState = {
  players,
  currentSeatId: asSeatId('declarer'),
  gamePhase: 'play',
  deck: [],
  teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
  teamScoreRecords: { 0: [], 1: [] },
  blowState: {
    currentTrump: null,
    currentHighestDeclaration: {
      seatId: asSeatId('declarer'),
      team: 0,
      trumpType: 'tra',
      numberOfPairs: 1,
      timestamp: 1,
    },
    declarations: [],
    actionHistory: [],
    lastPasserSeatId: null,
    isRoundCancelled: false,
    currentBlowIndex: 0,
  },
  playState: {
    currentField: {
      cards: [],
      playedBySeatIds: [],
      baseCard: '',
      dealerSeatId: asSeatId('declarer'),
      isComplete: false,
    },
    negriCard: null,
    negriSeatId: null,
    neguri: {},
    fields: [],
    openDeclared: false,
    openDeclarerSeatId: null,
  },
  roundNumber: 1,
  pointsToWin: 20,
};

function createMockedUseCase(actor: DomainPlayer, valid: boolean) {
  const roomGameState = {
    getState: jest.fn(() => state),
    findPlayerByActorId: jest.fn(() => actor),
    saveState: jest.fn(),
  };
  const roomService = {
    getRoom: jest.fn().mockResolvedValue({ settings: { gameMode: 'pro' } }),
    getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
  };
  const openRules = { canDeclareOpen: jest.fn(() => valid) };
  const violation = {
    type: 'wrong-open',
    violatorSeatId: actor.seatId,
    timestamp: 1,
    reportedBySeatId: null,
    isExpired: false,
  };
  const chombo = { recordViolation: jest.fn(() => violation) };
  const useCase = new DeclareOpenUseCase(
    roomService as never,
    openRules as never,
    chombo as never,
    new ScoreService(),
  );
  return { useCase, openRules, violation };
}

const scoreService = new ScoreService();

const eventNames = (events?: { event: string }[]) =>
  events?.map(({ event }) => event);

function completedFields(
  team0Wins: number,
  team1Wins: number,
): CompletedField[] {
  const field = (winnerTeam: Team): CompletedField => ({
    cards: [],
    winnerSeatId: asSeatId(winnerTeam === 0 ? 'winner' : 'opponent'),
    winnerTeam,
    dealerSeatId: asSeatId('winner'),
  });
  return [
    ...Array.from({ length: team0Wins }, () => field(0)),
    ...Array.from({ length: team1Wins }, () => field(1)),
  ];
}

// Seats run winner (declared 7 pairs, team 0) -> opponent -> partner ->
// opponent-2, with clubs as trump.
async function createOpenGame(
  hands: { winner: string[]; opponent: string[] },
  fields: CompletedField[],
) {
  const fixture = await createGame(hands.winner, [
    seat('opponent', 1, hands.opponent),
    seat('partner', 0, ['5♦', '6♦', '7♦']),
    seat('opponent-2', 1, ['5♠', '6♠', '7♠']),
  ]);
  const gameState = fixture.game.getState();
  gameState.blowState.currentTrump = 'club';
  gameState.playState!.fields = fields;
  return fixture;
}

describe('DeclareOpenUseCase', () => {
  beforeEach(() => {
    state.gamePhase = 'play';
    state.currentSeatId = asSeatId('declarer');
    state.playState!.openDeclared = false;
    state.playState!.openResolved = false;
    state.playState!.chomboViolations = [];
  });

  it('records an invalid open for the later chombo report flow without settling the round', async () => {
    const { useCase, violation } = createMockedUseCase(players[0], false);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorId: 'user-1',
    });

    expect(result.success).toBe(true);
    expect(state.playState?.openResolved).toBe(false);
    expect(state.playState?.chomboViolations).toEqual([violation]);
    expect(eventNames(result.events)).toEqual(['open-declared']);
    expect(result.events?.[0].payload).toMatchObject({ valid: false });
    expect(result.delayedEvents).toBeUndefined();
  });

  it('still lets an opposing seat open after another seat opened wrongly', async () => {
    const wrongOpener = createMockedUseCase(players[0], false);
    await wrongOpener.useCase.execute({ roomId: 'room-1', actorId: 'user-1' });

    const defender = createMockedUseCase(players[2], false);
    const result = await defender.useCase.execute({
      roomId: 'room-1',
      actorId: 'user-3',
    });

    expect(result.success).toBe(true);
    expect(defender.openRules.canDeclareOpen).toHaveBeenCalled();
    expect(state.playState?.chomboViolations).toEqual([
      wrongOpener.violation,
      defender.violation,
    ]);
  });

  it('rejects a second open from the seat that already opened wrongly', async () => {
    const { useCase, openRules } = createMockedUseCase(players[0], false);
    await useCase.execute({ roomId: 'room-1', actorId: 'user-1' });
    openRules.canDeclareOpen.mockClear();

    const result = await useCase.execute({
      roomId: 'room-1',
      actorId: 'user-1',
    });

    expect(result).toEqual({
      success: false,
      error: 'Open has already been declared',
    });
    expect(openRules.canDeclareOpen).not.toHaveBeenCalled();
    expect(state.playState?.chomboViolations).toHaveLength(1);
  });

  it('rejects an open once a valid open has settled the round', async () => {
    const { useCase, openRules } = createMockedUseCase(players[2], true);
    state.playState!.openResolved = true;

    const result = await useCase.execute({
      roomId: 'room-1',
      actorId: 'user-3',
    });

    expect(result).toEqual({
      success: false,
      error: 'Open has already been declared',
    });
    expect(openRules.canDeclareOpen).not.toHaveBeenCalled();
  });

  it(`rejects an open while the player holds more than ${OPEN_MAX_HAND_SIZE} cards`, async () => {
    const declarer = seat(
      'declarer',
      0,
      Array.from(
        { length: OPEN_MAX_HAND_SIZE + 1 },
        (_, index) => `${index + 5}♠`,
      ),
    );
    const { useCase, openRules } = createMockedUseCase(declarer, true);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorId: 'user-1',
    });

    expect(result).toEqual({
      success: false,
      error: 'Open is only available with four or fewer cards in hand',
    });
    expect(openRules.canDeclareOpen).not.toHaveBeenCalled();
    expect(state.playState?.openDeclared).toBe(false);
  });

  it('rejects an open once the hand is empty', async () => {
    const declarer = seat('declarer', 0, []);
    const { useCase, openRules } = createMockedUseCase(declarer, true);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorId: 'user-1',
    });

    expect(result).toEqual({
      success: false,
      error: 'Open is only available while you hold cards',
    });
    expect(openRules.canDeclareOpen).not.toHaveBeenCalled();
    expect(state.playState?.openDeclared).toBe(false);
  });

  describe('valid open', () => {
    it('scores the unplayed fields for the opener like a played-out round and deals the next round', async () => {
      const fixture = await createOpenGame(
        { winner: ['A♣', 'K♣', 'Q♣'], opponent: ['5♥', '6♥', '7♥'] },
        completedFields(4, 3),
      );
      try {
        const roundNumber = fixture.game.getState().roundNumber;

        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'winner',
        });

        expect(result.success).toBe(true);
        // 4 won + 3 unplayed fields against the 7 declared pairs.
        const { teamScores } = fixture.game.getState();
        expect(teamScores[0].total).toBe(
          scoreService.calculatePlayPoints(7, 7),
        );
        expect(teamScores[1].total).toBe(0);
        expect(eventNames(result.events)).toEqual([
          'open-declared',
          'round-results',
        ]);
        expect(eventNames(result.delayedEvents)).toEqual([
          'round-reset',
          'new-round-started',
          'update-turn',
          'update-phase',
        ]);
        expect(result.delayedEvents?.[3].payload).toMatchObject({
          phase: 'blow',
        });
        expect(result.gameOver).toBeUndefined();
        expect(fixture.game.getState()).toMatchObject({
          gamePhase: 'blow',
          roundNumber: roundNumber + 1,
        });
      } finally {
        await fixture.module.close();
      }
    });

    it('lets the declaring team keep only the fields it won when a defender opens', async () => {
      const fixture = await createOpenGame(
        { winner: ['5♥', '6♥', '7♥'], opponent: ['A♣', 'K♣', 'Q♣'] },
        completedFields(6, 1),
      );
      try {
        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'opponent',
        });

        expect(result.success).toBe(true);
        // The declaring team stops at 6 of its 7 pairs, so the defenders
        // score the shortfall.
        const { teamScores } = fixture.game.getState();
        expect(teamScores[0].total).toBe(0);
        expect(teamScores[1].total).toBe(
          Math.abs(scoreService.calculatePlayPoints(7, 6)),
        );
      } finally {
        await fixture.module.close();
      }
    });

    it('does not count a negri the declarer has not placed yet', async () => {
      // Pro mode lets the declarer keep the agari until they place it, so they
      // hold one card more than the fields that are left.
      const fixture = await createOpenGame(
        {
          winner: ['A♣', 'K♣', 'Q♣', 'J♣'],
          opponent: ['5♥', '6♥', '7♥'],
        },
        completedFields(4, 3),
      );
      try {
        expect(fixture.game.getState().playState?.negriCard).toBeNull();

        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'winner',
        });

        expect(result.success).toBe(true);
        // 4 won + 3 left, not 4: the unplaced negri is not a field.
        expect(fixture.game.getState().teamScores[0].total).toBe(
          scoreService.calculatePlayPoints(7, 7),
        );
      } finally {
        await fixture.module.close();
      }
    });

    it('counts the field in progress once', async () => {
      const fixture = await createOpenGame(
        { winner: ['K♣', 'Q♣'], opponent: ['5♥', '6♥', '7♥'] },
        completedFields(4, 3),
      );
      try {
        const gameState = fixture.game.getState();
        gameState.playState!.currentField = {
          cards: ['A♣'],
          playedBySeatIds: [asSeatId('winner')],
          baseCard: 'A♣',
          dealerSeatId: asSeatId('winner'),
          isComplete: false,
        };
        gameState.currentSeatId = asSeatId('opponent');

        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'winner',
        });

        expect(result.success).toBe(true);
        expect(fixture.game.getState().teamScores[0].total).toBe(
          scoreService.calculatePlayPoints(7, 7),
        );
      } finally {
        await fixture.module.close();
      }
    });

    it('ends the game through the regular game-over flow', async () => {
      const fixture = await createOpenGame(
        { winner: ['A♣', 'K♣', 'Q♣'], opponent: ['5♥', '6♥', '7♥'] },
        completedFields(4, 3),
      );
      try {
        fixture.game.getState().pointsToWin = scoreService.calculatePlayPoints(
          7,
          7,
        );

        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'winner',
        });

        expect(result.success).toBe(true);
        expect(eventNames(result.events)).toEqual([
          'open-declared',
          'round-results',
          'game-over',
        ]);
        expect(result.gameOver).toMatchObject({
          winningTeam: 0,
          resetDelayMs: 5000,
        });
        expect(result.delayedEvents).toBeUndefined();
        expect(fixture.updateRoomStatus).toHaveBeenCalledWith(
          'room-1',
          RoomStatus.FINISHED,
        );
      } finally {
        await fixture.module.close();
      }
    });
  });
});
