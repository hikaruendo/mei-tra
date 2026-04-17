import { PlayerReferenceRemapperService } from '../player-reference-remapper.service';
import { GameState } from '../../types/game.types';

describe('PlayerReferenceRemapperService', () => {
  it('rewrites player references across play and blow state', () => {
    const service = new PlayerReferenceRemapperService();
    const state = {
      players: [],
      currentPlayerIndex: 0,
      gamePhase: 'play',
      deck: [],
      teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
      teamScoreRecords: { 0: [], 1: [] },
      blowState: {
        currentTrump: 'herz',
        currentHighestDeclaration: {
          playerId: 'old',
          trumpType: 'herz',
          numberOfPairs: 7,
          timestamp: 1,
        },
        declarations: [
          {
            playerId: 'old',
            trumpType: 'herz',
            numberOfPairs: 7,
            timestamp: 1,
          },
        ],
        actionHistory: [
          {
            type: 'declare',
            playerId: 'old',
            trumpType: 'herz',
            numberOfPairs: 7,
            timestamp: 1,
          },
        ],
        lastPasser: 'old',
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      playState: {
        currentField: {
          cards: [],
          playedBy: [],
          baseCard: '',
          dealerId: 'old',
          isComplete: false,
        },
        negriCard: null,
        neguri: { old: 'J♠' },
        fields: [
          { cards: [], winnerId: 'old', winnerTeam: 0, dealerId: 'old' },
        ],
        lastWinnerId: 'old',
        openDeclared: false,
        openDeclarerId: 'old',
      },
      roundNumber: 1,
      pointsToWin: 10,
      teamAssignments: {},
    } as GameState;

    service.remapGameStatePlayerIdReferences(state, 'old', 'new');

    expect(state.playState?.currentField?.dealerId).toBe('new');
    expect(state.playState?.lastWinnerId).toBe('new');
    expect(state.playState?.neguri.new).toBe('J♠');
    expect(state.playState?.fields[0].winnerId).toBe('new');
    expect(state.blowState.currentHighestDeclaration?.playerId).toBe('new');
    expect(state.blowState.declarations[0].playerId).toBe('new');
    expect(state.blowState.actionHistory[0].playerId).toBe('new');
    expect(state.blowState.lastPasser).toBe('new');
  });
});
