import type { PlayerContract } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';
import {
  createEmptyGameEventState,
  reduceGameEvent,
} from '@meitra/game-client/game-event-reducer';

const createPlayer = (seatId: string, hand: string[]): PlayerContract => ({
  socketId: `socket-${seatId}`,
  seatId: asSeatId(seatId),
  name: seatId,
  team: seatId === 'seat-1' ? 0 : 1,
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
      players,
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
  });

  it('keeps the server turn when card-played omits nextSeatId', () => {
    const state = {
      ...createEmptyGameEventState(),
      players: [
        createPlayer('seat-1', ['5♣']),
        createPlayer('seat-2', ['6♣']),
      ],
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

  it('leaves the hands to the authoritative players sync', () => {
    const state = {
      ...createEmptyGameEventState(),
      players: [
        createPlayer('seat-1', ['5♣', '6♣']),
        createPlayer('seat-2', ['5♣', '7♣']),
      ],
      blowState: {
        ...createEmptyGameEventState().blowState,
        currentHighestDeclaration: {
          seatId: asSeatId('seat-1'),
          trumpType: 'club' as const,
          numberOfPairs: 6,
          timestamp: 1,
        },
      },
    };

    const next = reduceGameEvent(state, {
      type: 'play-setup-complete',
      payload: {
        negriCard: '5♣',
        startingSeatId: asSeatId('seat-1'),
      },
    });

    // SelectNegriUseCase emits the players with the negri already removed
    // right before this event, so trimming the hand again here would only let
    // a stale copy of the players win.
    expect(next.players).toBe(state.players);
    expect(next.negriCard).toBe('5♣');
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
