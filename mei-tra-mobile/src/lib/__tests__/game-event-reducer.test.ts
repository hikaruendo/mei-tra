import type { PlayerContract } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';
import {
  createEmptyGameEventState,
  reduceGameEvent,
} from '@meitra/game-client/game-event-reducer';
import {
  normalizeBlowDeclarationIdentity,
  normalizePlayerIdentities,
} from '@meitra/game-client/identity';

const createPlayer = (playerId: string, hand: string[]): PlayerContract => ({
  socketId: `socket-${playerId}`,
  seatId: asSeatId(playerId),
  name: playerId,
  team: playerId === 'seat-1' ? 0 : 1,
  hand,
  isPasser: false,
});

describe('reduceGameEvent', () => {
  it('uses only canonical seat fields through one event path', () => {
    const players = [
      createPlayer('seat-1', ['5♣']),
      createPlayer('seat-2', ['6♣']),
    ];
    const state = {
      ...createEmptyGameEventState(),
      players: normalizePlayerIdentities(players),
      gamePhase: 'play' as const,
    };

    const afterCard = reduceGameEvent(state, {
      type: 'card-played',
      payload: {
        seatId: asSeatId('seat-1'),
        card: '5♣',
        players: [createPlayer('seat-1', []), createPlayer('seat-2', ['6♣'])],
        field: {
          cards: ['5♣'],
          playedBySeatIds: [asSeatId('seat-1')],
          baseCard: '5♣',
          dealerSeatId: asSeatId('seat-1'),
          isComplete: false,
        },
        nextSeatId: asSeatId('seat-2'),
      },
    });

    expect(afterCard.currentTurnSeatId).toBe('seat-2');
    expect(afterCard.currentField?.playedBySeatIds).toEqual(['seat-1']);

    const afterBlowStart = reduceGameEvent(afterCard, {
      type: 'blow-started',
      payload: {
        startingSeatId: asSeatId('seat-1'),
        players,
      },
    });

    expect(afterBlowStart.currentTurnSeatId).toBe('seat-1');
    expect(afterBlowStart.players[0]?.seatId).toBe('seat-1');
  });

  it('keeps the server turn when card-played omits nextSeatId', () => {
    const state = {
      ...createEmptyGameEventState(),
      players: normalizePlayerIdentities([
        createPlayer('seat-1', ['5♣']),
        createPlayer('seat-2', ['6♣']),
      ]),
      currentTurnSeatId: asSeatId('seat-1'),
      gamePhase: 'play' as const,
    };

    const next = reduceGameEvent(state, {
      type: 'card-played',
      payload: {
        seatId: asSeatId('seat-1'),
        card: '5♣',
        players: [createPlayer('seat-1', []), createPlayer('seat-2', ['6♣'])],
        field: {
          cards: ['5♣'],
          playedBySeatIds: [asSeatId('seat-1')],
          baseCard: '5♣',
          dealerSeatId: asSeatId('seat-1'),
          isComplete: false,
        },
      },
    });

    expect(next.currentTurnSeatId).toBe('seat-1');
  });

  it('removes the negri card only from the identified self seat', () => {
    const state = {
      ...createEmptyGameEventState(),
      players: normalizePlayerIdentities([
        createPlayer('seat-1', ['5♣', '6♣']),
        createPlayer('seat-2', ['5♣', '7♣']),
      ]),
      blowState: {
        ...createEmptyGameEventState().blowState,
        currentHighestDeclaration: normalizeBlowDeclarationIdentity({
          seatId: asSeatId('seat-1'),
          trumpType: 'club' as const,
          numberOfPairs: 6,
          timestamp: 1,
        }),
      },
    };

    const next = reduceGameEvent(
      state,
      {
        type: 'play-setup-complete',
        payload: {
          negriCard: '5♣',
          startingSeatId: asSeatId('seat-1'),
        },
      },
      { selfSeatId: 'seat-1' },
    );

    expect(next.players[0]?.hand).toEqual(['6♣']);
    expect(next.players[1]?.hand).toEqual(['5♣', '7♣']);
    expect(next.negriSeatId).toBe('seat-1');
    expect(next.blowState.currentTrump).toBe('club');
  });

  it('deduplicates completed fields across repeated Socket delivery', () => {
    const state = createEmptyGameEventState();
    const payload = {
      winnerSeatId: asSeatId('seat-1'),
      nextSeatId: asSeatId('seat-1'),
      field: {
        cards: ['5♣', '6♣', '7♣', '8♣'],
        winnerSeatId: asSeatId('seat-1'),
        winnerTeam: 0 as const,
        dealerSeatId: asSeatId('seat-2'),
      },
    };

    const once = reduceGameEvent(state, {
      type: 'field-complete',
      payload,
    });
    const twice = reduceGameEvent(once, {
      type: 'field-complete',
      payload,
    });

    expect(twice.fields).toHaveLength(1);
    expect(twice.currentField?.dealerSeatId).toBe('seat-1');
  });
});
