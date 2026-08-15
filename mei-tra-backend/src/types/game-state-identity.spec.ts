import { normalizeGameStateIdentity } from './game-state-identity';
import { asSeatId } from './identity.types';
import type { GameState } from './game.types';

describe('normalizeGameStateIdentity', () => {
  it('prefers canonical seat fields over stale legacy aliases', () => {
    const state: GameState = {
      identitySchemaVersion: 2,
      players: [
        {
          seatId: asSeatId('seat-1'),
          name: 'Player 1',
          team: 0,
          hand: [],
          isPasser: false,
        },
      ],
      currentSeatId: asSeatId('seat-1'),
      gamePhase: 'play',
      deck: [],
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      },
      teamScoreRecords: { 0: [], 1: [] },
      blowState: {
        currentTrump: null,
        currentHighestDeclaration: null,
        declarations: [],
        actionHistory: [],
        lastPasserSeatId: asSeatId('seat-1'),
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      playState: {
        currentField: {
          cards: [],
          playedBySeatIds: [asSeatId('seat-1')],
          playedBy: ['legacy-player'],
          baseCard: '',
          dealerSeatId: asSeatId('seat-1'),
          isComplete: false,
        },
        negriCard: '5♣',
        negriSeatId: asSeatId('seat-1'),
        neguri: {},
        fields: [],
        lastWinnerSeatId: asSeatId('seat-1'),
        openDeclared: false,
        openDeclarerSeatId: asSeatId('seat-1'),
      },
      roundNumber: 1,
      pointsToWin: 5,
      teamAssignments: { 'legacy-player': 0 },
    };

    const normalized = normalizeGameStateIdentity(state);

    expect(normalized.players[0]).toEqual(
      expect.objectContaining({ seatId: asSeatId('seat-1') }),
    );
    expect(normalized.players[0]).not.toHaveProperty('playerId');
    expect(normalized.currentSeatId).toBe('seat-1');
    expect(normalized.blowState.lastPasserSeatId).toBe('seat-1');
    expect(normalized.playState?.currentField?.playedBy).toEqual(['seat-1']);
    expect(normalized.playState?.currentField?.playedBySeatIds).toEqual([
      'seat-1',
    ]);
    expect(normalized.playState?.currentField?.playedBy).not.toBe(
      normalized.playState?.currentField?.playedBySeatIds,
    );
    expect(normalized.playState?.currentField?.dealerSeatId).toBe('seat-1');
    expect(normalized.playState?.negriSeatId).toBe('seat-1');
    expect(normalized.playState?.lastWinnerSeatId).toBe('seat-1');
    expect(normalized.playState?.openDeclarerSeatId).toBe('seat-1');
    expect(normalized.teamAssignments).toEqual({ 'seat-1': 0 });
  });

  it('repairs duplicated field attributions written by shared aliases', () => {
    const state = {
      identitySchemaVersion: 2,
      players: [
        {
          seatId: asSeatId('seat-1'),
          name: 'Player 1',
          team: 0,
          hand: [],
          isPasser: false,
        },
        {
          seatId: asSeatId('seat-2'),
          name: 'Player 2',
          team: 1,
          hand: [],
          isPasser: false,
        },
      ],
      currentSeatId: asSeatId('seat-1'),
      gamePhase: 'play',
      deck: [],
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      },
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
          cards: ['5♣', '6♠'],
          playedBySeatIds: [
            asSeatId('seat-1'),
            asSeatId('seat-1'),
            asSeatId('seat-2'),
            asSeatId('seat-2'),
          ],
          playedBy: ['seat-1', 'seat-1', 'seat-2', 'seat-2'],
          baseCard: '5♣',
          dealerSeatId: asSeatId('seat-1'),
          isComplete: false,
        },
        negriCard: null,
        negriSeatId: null,
        neguri: {},
        fields: [],
        lastWinnerSeatId: null,
        openDeclared: false,
        openDeclarerSeatId: null,
      },
      roundNumber: 1,
      pointsToWin: 5,
      teamAssignments: { 'seat-1': 0, 'seat-2': 1 },
    } satisfies GameState;

    const normalized = normalizeGameStateIdentity(state);

    expect(normalized.playState?.currentField?.playedBy).toEqual([
      'seat-1',
      'seat-2',
    ]);
    expect(normalized.playState?.currentField?.playedBySeatIds).toEqual([
      'seat-1',
      'seat-2',
    ]);
  });
});
