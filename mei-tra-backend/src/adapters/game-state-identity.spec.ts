import { normalizeGameStateIdentity } from './game-state-identity';
import { asSeatId } from '../types/identity.types';
import type { GameState } from '../types/game.types';

describe('normalizeGameStateIdentity', () => {
  it('normalizes seat references and rebuilds team assignments', () => {
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
    };

    const normalized = normalizeGameStateIdentity(state);

    expect(normalized.players[0]).toEqual(
      expect.objectContaining({ seatId: asSeatId('seat-1') }),
    );
    expect(normalized.players[0]).not.toHaveProperty('playerId');
    expect(normalized.currentSeatId).toBe('seat-1');
    expect(normalized.blowState.lastPasserSeatId).toBe('seat-1');
    expect(normalized.playState?.currentField?.playedBySeatIds).toEqual([
      'seat-1',
    ]);
    expect(normalized.playState?.currentField?.dealerSeatId).toBe('seat-1');
    expect(normalized.playState?.negriSeatId).toBe('seat-1');
    expect(normalized.playState?.lastWinnerSeatId).toBe('seat-1');
    expect(normalized.playState?.openDeclarerSeatId).toBe('seat-1');
  });
});
