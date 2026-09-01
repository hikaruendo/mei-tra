import { asSeatId } from '../types/identity.types';
import type { Field, GameState } from '../types/game.types';
import {
  createFieldCheckpoint,
  getFieldIntegrityError,
  restoreFieldCheckpoint,
} from './field-recovery';

const seatIds = ['p1', 'p2', 'p3', 'p4'].map(asSeatId);

const buildState = (): GameState => ({
  players: seatIds.map((seatId, index) => ({
    seatId,
    name: `Player ${index + 1}`,
    hand: [`card-${index}`],
    team: (index % 2) as 0 | 1,
    isPasser: false,
  })),
  currentSeatId: seatIds[0],
  gamePhase: 'play',
  deck: [],
  teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
  teamScoreRecords: { 0: [], 1: [] },
  blowState: {
    currentTrump: null,
    currentHighestDeclaration: null,
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
      dealerSeatId: seatIds[0],
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
  roundNumber: 2,
  pointsToWin: 5,
});

describe('field recovery', () => {
  it('captures and restores hands, turn, and the empty field', () => {
    const state = buildState();
    const checkpoint = createFieldCheckpoint(state);
    expect(checkpoint).not.toBeNull();

    state.playState!.fieldCheckpoint = checkpoint;
    state.players[0].hand = [];
    state.currentSeatId = seatIds[2];
    state.playState!.currentField = {
      cards: ['card-0', 'card-1'],
      playedBySeatIds: [seatIds[0], seatIds[0]],
      baseCard: 'card-0',
      dealerSeatId: seatIds[0],
      isComplete: false,
    };

    expect(restoreFieldCheckpoint(state)).toBe(true);
    expect(state.players[0].hand).toEqual(['card-0']);
    expect(state.currentSeatId).toBe(seatIds[0]);
    expect(state.playState?.currentField?.cards).toEqual([]);
    expect(state.playState?.fieldCheckpoint).toBeNull();
  });

  it('rejects a checkpoint from another round', () => {
    const state = buildState();
    state.playState!.fieldCheckpoint = createFieldCheckpoint(state);
    state.roundNumber += 1;

    expect(restoreFieldCheckpoint(state)).toBe(false);
  });

  it('detects duplicate player attribution', () => {
    const state = buildState();
    const field: Field = {
      cards: ['A', 'B'],
      playedBySeatIds: [seatIds[0], seatIds[0]],
      baseCard: 'A',
      dealerSeatId: seatIds[0],
      isComplete: false,
    };

    expect(getFieldIntegrityError(state, field)).toBe(
      'Field contains duplicate player attribution',
    );
  });
});
