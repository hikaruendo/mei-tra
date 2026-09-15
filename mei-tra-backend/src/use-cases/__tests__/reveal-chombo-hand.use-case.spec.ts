import { RevealChomboHandUseCase } from '../reveal-chombo-hand.use-case';
import { asSeatId } from '../../types/identity.types';
import type { GameState } from '../../types/game.types';

describe('RevealChomboHandUseCase', () => {
  const state: GameState = {
    players: [
      { seatId: asSeatId('target'), name: 'Target', team: 0, hand: ['A♠'], isPasser: false },
      { seatId: asSeatId('reporter'), name: 'Reporter', team: 1, hand: ['K♥'], isPasser: false },
    ],
    currentSeatId: asSeatId('reporter'),
    gamePhase: 'play',
    deck: [],
    teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
    teamScoreRecords: { 0: [], 1: [] },
    blowState: { currentTrump: null, currentHighestDeclaration: null, declarations: [], actionHistory: [], lastPasserSeatId: null, isRoundCancelled: false, currentBlowIndex: 0 },
    playState: { currentField: null, negriCard: null, negriSeatId: null, neguri: {}, fields: [], openDeclared: false, chomboRoundNumber: 1, chomboViolations: [{ type: 'wrong-suit', violatorSeatId: asSeatId('target'), timestamp: 1, reportedBySeatId: null, isExpired: false }] },
    roundNumber: 1,
    pointsToWin: 20,
  };

  function create() {
    const roomGameState = { getState: jest.fn(() => state), findPlayerByActorId: jest.fn((actorId: string) => actorId === 'target' ? state.players[0] : state.players[1]), saveState: jest.fn() };
    const roomService = { getRoom: jest.fn().mockResolvedValue({ settings: { gameMode: 'pro' } }), getRoomGameState: jest.fn().mockResolvedValue(roomGameState) };
    return { useCase: new RevealChomboHandUseCase(roomService as never), roomGameState };
  }

  it('reveals only the target player hand and emits a synchronized event', async () => {
    const { useCase, roomGameState } = create();
    const result = await useCase.execute({ roomId: 'room-1', actorId: 'target', seatId: asSeatId('target') });
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(state.playState?.revealedHands).toEqual({ target: ['A♠'] });
    expect(result.events).toContainEqual(expect.objectContaining({ event: 'chombo-hand-revealed', payload: { seatId: 'target', hand: ['A♠'] } }));
    expect(roomGameState.saveState).toHaveBeenCalled();
  });

  it('rejects reveal when the candidate has expired', async () => {
    state.playState!.revealedHands = undefined;
    state.playState!.chomboViolations![0].isExpired = true;
    const { useCase } = create();
    await expect(useCase.execute({ roomId: 'room-1', actorId: 'target', seatId: asSeatId('target') })).resolves.toEqual({ success: false, error: 'No chombo check requires this hand' });
    state.playState!.chomboViolations![0].isExpired = false;
  });

  it('rejects a different actor from revealing the target hand', async () => {
    const { useCase } = create();
    await expect(useCase.execute({ roomId: 'room-1', actorId: 'reporter', seatId: asSeatId('target') })).resolves.toEqual({ success: false, error: 'Only the target player may reveal their hand' });
  });
});
