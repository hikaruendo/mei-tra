import {
  findUnknownPersistedSeatReferences,
  toPersistedBlowState,
  toPersistedPendingBrokenHandReveal,
  toPersistedPlayState,
} from './game-state-persistence';
import { asSeatId } from './identity.types';

const firstSeatId = asSeatId('11111111-1111-4111-8111-111111111111');
const secondSeatId = asSeatId('22222222-2222-4222-8222-222222222222');

describe('game-state persistence identity', () => {
  it('persists blow references with canonical seat keys only', () => {
    const persisted = toPersistedBlowState({
      currentTrump: 'herz',
      currentHighestDeclaration: {
        seatId: firstSeatId,
        trumpType: 'herz',
        numberOfPairs: 6,
        timestamp: 1,
      },
      declarations: [
        {
          seatId: firstSeatId,
          trumpType: 'herz',
          numberOfPairs: 6,
          timestamp: 1,
        },
      ],
      actionHistory: [
        {
          type: 'pass',
          seatId: secondSeatId,
          timestamp: 2,
        },
      ],
      lastPasserSeatId: secondSeatId,
      isRoundCancelled: false,
      currentBlowIndex: 2,
    });

    expect(persisted.currentHighestDeclaration?.seatId).toBe(firstSeatId);
    expect(persisted.lastPasserSeatId).toBe(secondSeatId);
    expect(JSON.stringify(persisted)).not.toContain('playerId');
    expect(JSON.stringify(persisted)).not.toContain('lastPasser"');
  });

  it('persists play and pending reveal references without aliases', () => {
    const persistedPlayState = toPersistedPlayState({
      currentField: {
        cards: ['H7'],
        playedBy: [firstSeatId],
        playedBySeatIds: [firstSeatId],
        baseCard: 'H7',
        dealerSeatId: asSeatId(secondSeatId),
        isComplete: false,
      },
      negriCard: 'S9',
      negriSeatId: firstSeatId,
      neguri: { [firstSeatId]: 'S9' },
      fields: [
        {
          cards: ['H7'],
          winnerSeatId: asSeatId(firstSeatId),
          winnerTeam: 0,
          dealerSeatId: asSeatId(secondSeatId),
        },
      ],
      lastWinnerSeatId: firstSeatId,
      openDeclared: true,
      openDeclarerSeatId: secondSeatId,
    });
    const persistedReveal = toPersistedPendingBrokenHandReveal({
      seatId: firstSeatId,
      handSnapshot: ['H7'],
      startedAt: 3,
    });
    const serialized = JSON.stringify({ persistedPlayState, persistedReveal });

    expect(persistedPlayState?.currentField?.playedBySeatIds).toEqual([
      firstSeatId,
    ]);
    expect(persistedPlayState?.fields[0].winnerSeatId).toBe(firstSeatId);
    expect(persistedReveal?.seatId).toBe(firstSeatId);
    expect(serialized).not.toContain('playerId');
    expect(serialized).not.toContain('playedBy"');
  });

  it('finds canonical nested seat references outside the room roster', () => {
    expect(
      findUnknownPersistedSeatReferences(
        {
          playerStates: { [firstSeatId]: { hand: [] } },
          playState: {
            currentField: {
              dealerSeatId: asSeatId(secondSeatId),
              playedBySeatIds: [firstSeatId, 'unknown-seat'],
            },
          },
        },
        new Set([firstSeatId, secondSeatId]),
      ),
    ).toEqual(['unknown-seat']);
  });
});
