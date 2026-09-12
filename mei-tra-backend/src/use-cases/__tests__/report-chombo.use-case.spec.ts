import { createGame } from './chombo-game.fixture';
import { asSeatId } from '../../types/identity.types';
import type { ChomboViolation } from '../../types/game.types';

const winner = asSeatId('winner');
const types: ChomboViolation['type'][] = [
  'negri-forget',
  'wrong-suit',
  'four-jack',
  'last-tanzen',
  'wrong-broken',
  'wrong-open',
];

describe('Chombo report adjudication from room state', () => {
  let fixture: Awaited<ReturnType<typeof createGame>>;
  beforeEach(async () => {
    fixture = await createGame(['A♠', 'K♠']);
    const state = fixture.game.getState();
    state.playState!.chomboRoundNumber = state.roundNumber;
  });
  afterEach(async () => {
    await fixture.module.close();
  });

  function report(violationType: ChomboViolation['type']) {
    return fixture.report.execute({
      roomId: 'room-1',
      actorId: 'opponent',
      violatorSeatId: winner,
      violationType,
    });
  }
  function candidate(type: ChomboViolation['type']): ChomboViolation {
    return {
      type,
      violatorSeatId: winner,
      timestamp: 1,
      reportedBySeatId: null,
      isExpired: false,
    };
  }

  it('does not award a correct report from a service-only stale candidate', async () => {
    fixture.chombo.recordViolation(winner, 'negri-forget');
    const result = await report('negri-forget');
    expect(result.success).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'chombo-resolved',
        payload: expect.objectContaining({ isCorrect: false, awardedTeam: 0 }),
      }),
    );
    expect(fixture.game.getState().teamScores).toEqual({
      0: { play: 5, total: 5 },
      1: { play: 0, total: 0 },
    });
  });

  it.each(types)('awards a persisted %s report exactly once', async (type) => {
    fixture.game.getState().playState!.chomboViolations = [candidate(type)];
    const first = await report(type);
    expect(first.success).toBe(true);
    expect(first.events).toContainEqual(
      expect.objectContaining({
        event: 'chombo-resolved',
        payload: expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
      }),
    );
    expect(fixture.game.getState().gamePhase).toBe('play');
    const second = await report(type);
    expect(second.success).toBe(false);
    expect(fixture.game.getState().teamScores).toEqual({
      0: { play: 0, total: 0 },
      1: { play: 5, total: 5 },
    });
  });

  it('does not resurrect expired room candidates from the shared service', async () => {
    const stale = fixture.chombo.recordViolation(winner, 'wrong-open');
    fixture.game.getState().playState!.chomboViolations = [
      { ...stale, isExpired: true },
    ];
    const result = await report('wrong-open');
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'chombo-resolved',
        payload: expect.objectContaining({ isCorrect: false, awardedTeam: 0 }),
      }),
    );
  });

  it('rejects a report after the room changes round', async () => {
    fixture.game.getState().roundNumber = 2;
    const result = await report('wrong-open');
    expect(result.success).toBe(false);
    expect(fixture.game.getState().teamScores[0].total).toBe(0);
    expect(fixture.game.getState().teamScores[1].total).toBe(0);
  });

  it('rejects reports from normal-mode rooms', async () => {
    fixture.room.settings.gameMode = 'normal';
    const result = await report('wrong-open');
    expect(result).toEqual({
      success: false,
      error: 'Chombo reports are only available in pro mode',
    });
  });

  it('rejects a same-team target before scoring', async () => {
    fixture.game
      .getState()
      .players.find((player) => player.seatId === winner)!.team = 1;
    fixture.game.getState().playState!.chomboViolations = [
      candidate('wrong-suit'),
    ];
    const result = await report('wrong-suit');
    expect(result).toEqual({
      success: false,
      error: 'You can only report the opposing team',
    });
    expect(fixture.game.getState().teamScores[0].total).toBe(0);
    expect(fixture.game.getState().teamScores[1].total).toBe(0);
  });

  it('rejects reports issued by COM', async () => {
    fixture.game
      .getState()
      .players.find((player) => player.seatId === asSeatId('opponent'))!.isCOM =
      true;
    const result = await report('wrong-open');
    expect(result).toEqual({
      success: false,
      error: 'COM cannot report chombos',
    });
  });

  it('uses the room score target for immediate game-over', async () => {
    const state = fixture.game.getState();
    state.pointsToWin = 12;
    state.teamScores[1].total = 7;
    state.playState!.chomboViolations = [candidate('wrong-suit')];
    const result = await report('wrong-suit');
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'game-over' }),
    );
    expect(state.teamScores[1].total).toBe(12);
    expect(fixture.updateRoomStatus).toHaveBeenCalledWith('room-1', 'finished');
  });
});
