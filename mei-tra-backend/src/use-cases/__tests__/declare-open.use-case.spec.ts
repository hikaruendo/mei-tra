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
  const useCase = new DeclareOpenUseCase(
    roomService as never,
    openRules as never,
    new ScoreService(),
  );
  return { useCase, openRules };
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

  describe('failed open', () => {
    // The winner's hearts cannot beat the opponent's club trumps.
    const failingHands = {
      winner: ['5♥', '6♥', '7♥'],
      opponent: ['A♣', 'K♣', 'Q♣'],
    };

    it('gives the other team 5 points and deals the next round', async () => {
      const fixture = await createOpenGame(failingHands, completedFields(4, 3));
      try {
        const roundNumber = fixture.game.getState().roundNumber;

        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'winner',
        });

        expect(result.success).toBe(true);
        // Only the 5 points: the fields played so far are not scored.
        const { teamScores, playState } = fixture.game.getState();
        expect(teamScores[0].total).toBe(0);
        expect(teamScores[1].total).toBe(5);
        expect(eventNames(result.events)).toEqual([
          'open-declared',
          'round-results',
        ]);
        expect(result.events?.[0].payload).toEqual({
          declarerSeatId: asSeatId('winner'),
          hand: failingHands.winner,
          valid: false,
          awardedTeam: 1,
        });
        expect(result.roundStoppedEarly).toBe(true);
        expect(eventNames(result.delayedEvents)).toEqual([
          'round-reset',
          'new-round-started',
          'update-turn',
          'update-phase',
        ]);
        // A failed open is not a chombo, so nothing is left to report.
        expect(playState?.chomboViolations ?? []).toEqual([]);
        expect(fixture.game.getState()).toMatchObject({
          gamePhase: 'blow',
          roundNumber: roundNumber + 1,
        });
      } finally {
        await fixture.module.close();
      }
    });

    it('writes the failed open to the play log before the round completes', async () => {
      const fixture = await createOpenGame(failingHands, completedFields(4, 3));
      try {
        await fixture.open.execute({ roomId: 'room-1', actorId: 'winner' });

        const actionTypes = fixture.loggedEvents.map(
          (event) => event.actionType,
        );
        expect(
          actionTypes.filter((type) => type === 'open_failed'),
        ).toHaveLength(1);
        expect(actionTypes.indexOf('open_failed')).toBeLessThan(
          actionTypes.indexOf('round_completed'),
        );
        expect(
          fixture.loggedEvents.find(
            (event) => event.actionType === 'open_failed',
          ),
        ).toMatchObject({
          actorSeatId: asSeatId('winner'),
          actionData: { hand: failingHands.winner, awardedTeam: 1 },
        });
      } finally {
        await fixture.module.close();
      }
    });

    it('ends the game when the 5 points reach the target', async () => {
      const fixture = await createOpenGame(failingHands, completedFields(4, 3));
      try {
        fixture.game.getState().pointsToWin = 5;

        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'winner',
        });

        expect(eventNames(result.events)).toEqual([
          'open-declared',
          'round-results',
          'game-over',
        ]);
        expect(result.gameOver).toMatchObject({ winningTeam: 1 });
      } finally {
        await fixture.module.close();
      }
    });
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
        // A valid open is recorded only through the round it completes.
        expect(
          fixture.loggedEvents.map((event) => event.actionType),
        ).not.toContain('open_failed');
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

    it('rejects an open from a player whose turn has not started', async () => {
      const fixture = await createOpenGame(
        { winner: ['5♥', '6♥', '7♥'], opponent: ['A♣', 'K♣', 'Q♣'] },
        completedFields(6, 1),
      );
      try {
        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'opponent',
        });

        expect(result).toEqual({
          success: false,
          error: "It's not your turn to play",
        });
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

    it('rejects an open after the declarer already played in the current field', async () => {
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
        gameState.currentSeatId = asSeatId('winner');

        const result = await fixture.open.execute({
          roomId: 'room-1',
          actorId: 'winner',
        });

        expect(result).toEqual({
          success: false,
          error: 'Current seat already played in this field',
        });
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
