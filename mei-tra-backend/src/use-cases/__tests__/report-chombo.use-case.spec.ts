import { ReportChomboUseCase } from '../report-chombo.use-case';
import type { DomainPlayer, GameState } from '../../types/game.types';
import { asSeatId } from '../../types/identity.types';

describe('ReportChomboUseCase', () => {
  const reporter = {
    seatId: asSeatId('reporter'),
    name: 'Reporter',
    team: 0,
    hand: [],
    isPasser: false,
  } as DomainPlayer;
  const violator = {
    seatId: asSeatId('violator'),
    name: 'Violator',
    team: 1,
    hand: [],
    isPasser: false,
  } as DomainPlayer;

  const createFixture = (violation: object | null = { reportedBySeatId: null }) => {
    const state = {
      gamePhase: 'play',
      players: [reporter, violator],
      playState: { currentField: null, negriCard: null, neguri: {}, fields: [] },
      teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
    } as unknown as GameState;
    const gameState = {
      getState: () => state,
      findPlayerByActorId: () => reporter,
      saveState: jest.fn(),
    };
    const chomboService = {
      reportViolation: jest.fn(() => violation),
    };
    const roomService = {
      getRoom: jest.fn(async () => ({ settings: { gameMode: 'pro' } })),
      getRoomGameState: jest.fn(async () => gameState),
    };
    return { state, gameState, chomboService, roomService };
  };

  it('awards five points to the reporting team for a valid report', async () => {
    const fixture = createFixture();
    const useCase = new ReportChomboUseCase(
      fixture.roomService as never,
      fixture.chomboService as never,
    );

    const result = await useCase.execute({
      roomId: 'room-1',
      actorId: 'reporter',
      violatorSeatId: asSeatId('violator'),
      violationType: 'four-jack',
    });

    expect(result.success).toBe(true);
    expect(fixture.state.teamScores[0].total).toBe(5);
    expect(result.events?.[0].payload).toEqual(expect.objectContaining({ isCorrect: true, awardedTeam: 0 }));
  });

  it('awards five points to the violator team for an invalid report', async () => {
    const fixture = createFixture(null);
    const useCase = new ReportChomboUseCase(
      fixture.roomService as never,
      fixture.chomboService as never,
    );

    const result = await useCase.execute({
      roomId: 'room-1',
      actorId: 'reporter',
      violatorSeatId: asSeatId('violator'),
      violationType: 'wrong-open',
    });

    expect(result.success).toBe(true);
    expect(fixture.state.teamScores[1].total).toBe(5);
    expect(result.events?.[0].payload).toEqual(expect.objectContaining({ isCorrect: false, awardedTeam: 1 }));
  });
});
