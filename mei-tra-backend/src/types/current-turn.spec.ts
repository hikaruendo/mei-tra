import {
  resolveCurrentPlayer,
  resolveCurrentPlayerIndex,
  resolveCurrentSeatId,
  setCurrentSeat,
} from './current-turn';
import { asSeatId } from './identity.types';
import type { DomainPlayer, GameState } from './game.types';

const players: DomainPlayer[] = [
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
];

const turnState = (
  overrides: Partial<GameState> = {},
): Pick<GameState, 'players' | 'currentSeatId'> => ({
  players: players.map((player) => ({ ...player })),
  currentSeatId: asSeatId('seat-1'),
  ...overrides,
});

describe('current turn identity', () => {
  it('resolves the canonical seat and its roster position', () => {
    const state = turnState({ currentSeatId: asSeatId('seat-1') });

    expect(resolveCurrentSeatId(state)).toBe('seat-1');
    expect(resolveCurrentPlayerIndex(state)).toBe(0);
    expect(resolveCurrentPlayer(state)?.seatId).toBe('seat-1');
  });

  it('updates only the canonical seat assignment', () => {
    const state = turnState();

    const currentPlayer = setCurrentSeat(state, 'seat-2');

    expect(currentPlayer?.seatId).toBe('seat-2');
    expect(state.currentSeatId).toBe('seat-2');
  });

  it('does not infer a turn when the canonical seat is missing', () => {
    const state = {
      ...turnState({ currentSeatId: null }),
      currentPlayerId: 'seat-2',
      currentPlayerIndex: 1,
    };

    expect(resolveCurrentSeatId(state)).toBeNull();
    expect(resolveCurrentPlayerIndex(state)).toBe(-1);
    expect(resolveCurrentPlayer(state)).toBeNull();
  });

  it('rejects a seat outside the roster', () => {
    expect(() => setCurrentSeat(turnState(), 'seat-unknown')).toThrow(
      'Current seat seat-unknown is not in the game roster',
    );
  });
});
