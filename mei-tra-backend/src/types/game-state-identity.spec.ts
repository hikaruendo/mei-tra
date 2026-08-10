import { normalizeGameStateIdentityAliases } from './game-state-identity';
import { asSeatId } from './identity.types';
import type { GameState } from './game.types';

describe('normalizeGameStateIdentityAliases', () => {
  it('prefers canonical seat fields over stale legacy aliases', () => {
    const state: GameState = {
      identitySchemaVersion: 2,
      players: [
        {
          seatId: asSeatId('seat-1'),
          playerId: 'legacy-player',
          name: 'Player 1',
          team: 0,
          hand: [],
          isPasser: false,
        },
      ],
      currentSeatId: asSeatId('seat-1'),
      currentPlayerId: 'legacy-current',
      currentPlayerIndex: 0,
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
        lastPasser: 'legacy-passer',
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
          dealerId: 'legacy-dealer',
          isComplete: false,
        },
        negriCard: '5♣',
        negriSeatId: asSeatId('seat-1'),
        negriPlayerId: 'legacy-negri',
        neguri: {},
        fields: [],
        lastWinnerSeatId: asSeatId('seat-1'),
        lastWinnerId: 'legacy-winner',
        openDeclared: false,
        openDeclarerSeatId: asSeatId('seat-1'),
        openDeclarerId: 'legacy-open',
      },
      roundNumber: 1,
      pointsToWin: 5,
      teamAssignments: { 'legacy-player': 0 },
    };

    const normalized = normalizeGameStateIdentityAliases(state);

    expect(normalized.players[0]).toEqual(
      expect.objectContaining({ seatId: 'seat-1', playerId: 'seat-1' }),
    );
    expect(normalized.currentSeatId).toBe('seat-1');
    expect(normalized.currentPlayerId).toBe('seat-1');
    expect(normalized.blowState.lastPasserSeatId).toBe('seat-1');
    expect(normalized.blowState.lastPasser).toBe('seat-1');
    expect(normalized.playState?.currentField?.playedBy).toEqual(['seat-1']);
    expect(normalized.playState?.currentField?.dealerId).toBe('seat-1');
    expect(normalized.playState?.negriSeatId).toBe('seat-1');
    expect(normalized.playState?.negriPlayerId).toBe('seat-1');
    expect(normalized.playState?.lastWinnerId).toBe('seat-1');
    expect(normalized.playState?.openDeclarerId).toBe('seat-1');
    expect(normalized.teamAssignments).toEqual({ 'seat-1': 0 });
  });
});
