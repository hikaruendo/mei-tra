import { DeclareOpenUseCase } from '../declare-open.use-case';
import { asSeatId } from '../../types/identity.types';
import type { GameState, DomainPlayer } from '../../types/game.types';

const players: DomainPlayer[] = [
  { seatId: asSeatId('declarer'), name: 'Declarer', team: 0, hand: ['A♠'], isPasser: false },
  { seatId: asSeatId('partner'), name: 'Partner', team: 0, hand: ['K♠'], isPasser: false },
  { seatId: asSeatId('opponent'), name: 'Opponent', team: 1, hand: ['Q♥'], isPasser: false },
  { seatId: asSeatId('opponent-2'), name: 'Opponent 2', team: 1, hand: ['J♥'], isPasser: false },
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
    currentHighestDeclaration: { seatId: asSeatId('declarer'), team: 0, trumpType: 'tra', numberOfPairs: 1, timestamp: 1 },
    declarations: [], actionHistory: [], lastPasserSeatId: null, isRoundCancelled: false, currentBlowIndex: 0,
  },
  playState: {
    currentField: { cards: [], playedBySeatIds: [], baseCard: '', dealerSeatId: asSeatId('declarer'), isComplete: false },
    negriCard: null, negriSeatId: null, neguri: {}, fields: [], openDeclared: false, openDeclarerSeatId: null,
  },
  roundNumber: 1,
  pointsToWin: 20,
};

describe('DeclareOpenUseCase', () => {
  it('settles the remaining tricks for the declarer team after a valid open', async () => {
    const roomGameState = {
      getState: jest.fn(() => state),
      findPlayerByActorId: jest.fn(() => players[0]),
      saveState: jest.fn(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({ settings: { gameMode: 'pro' } }),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    };
    const openRules = { canDeclareOpen: jest.fn(() => true) };
    const chombo = { recordViolation: jest.fn() };
    const score = { calculatePlayPoints: jest.fn(() => 3) };
    const useCase = new DeclareOpenUseCase(roomService as never, openRules as never, chombo as never, score as never);

    const result = await useCase.execute({ roomId: 'room-1', actorId: 'user-1' });

    expect(result.success).toBe(true);
    expect(state.teamScores[0].total).toBe(3);
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'open-declared' }),
      expect.objectContaining({ event: 'round-results' }),
    ]));
    expect(state.playState?.openResolved).toBe(true);
  });

  it('records an invalid open for the later chombo report flow without settling the round', async () => {
    state.playState!.openDeclared = false;
    state.playState!.openResolved = false;
    state.playState!.chomboViolations = [];
    const roomGameState = {
      getState: jest.fn(() => state),
      findPlayerByActorId: jest.fn(() => players[0]),
      saveState: jest.fn(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({ settings: { gameMode: 'pro' } }),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    };
    const openRules = { canDeclareOpen: jest.fn(() => false) };
    const violation = { type: 'wrong-open', violatorSeatId: players[0].seatId, timestamp: 1, reportedBySeatId: null, isExpired: false };
    const chombo = { recordViolation: jest.fn(() => violation) };
    const score = { calculatePlayPoints: jest.fn(() => 3) };
    const useCase = new DeclareOpenUseCase(roomService as never, openRules as never, chombo as never, score as never);

    const result = await useCase.execute({ roomId: 'room-1', actorId: 'user-1' });

    expect(result.success).toBe(true);
    expect(state.playState?.openResolved).toBe(false);
    expect(state.playState?.chomboViolations).toEqual([violation]);
    expect(result.events).toContainEqual(expect.objectContaining({
      event: 'open-declared',
      payload: expect.objectContaining({ valid: false }),
    }));
    expect(result.events).not.toContainEqual(expect.objectContaining({ event: 'round-results' }));
  });

  it('allows a player from either team to declare open', async () => {
    state.playState!.openDeclared = false;
    state.playState!.openResolved = false;
    state.playState!.chomboViolations = [];
    const opponent = players[2];
    const roomGameState = {
      getState: jest.fn(() => state),
      findPlayerByActorId: jest.fn(() => opponent),
      saveState: jest.fn(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({ settings: { gameMode: 'pro' } }),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    };
    const openRules = { canDeclareOpen: jest.fn(() => true) };
    const chombo = { recordViolation: jest.fn() };
    const score = { calculatePlayPoints: jest.fn(() => 3) };
    const useCase = new DeclareOpenUseCase(roomService as never, openRules as never, chombo as never, score as never);

    const result = await useCase.execute({ roomId: 'room-1', actorId: 'opponent-user' });

    expect(result.success).toBe(true);
    expect(state.playState?.openDeclarerSeatId).toBe(opponent.seatId);
    expect(openRules.canDeclareOpen).toHaveBeenCalledWith(state, opponent.seatId);
  });
});
