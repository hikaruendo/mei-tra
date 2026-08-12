import { asSeatId, SeatId } from './identity.types';
import type { DomainPlayer, GameState } from './game.types';

type CurrentTurnState = Pick<GameState, 'players' | 'currentSeatId'>;

function playerSeatId(player: DomainPlayer): SeatId {
  return player.seatId ?? asSeatId(player.playerId);
}

export function resolveCurrentSeatId(state: CurrentTurnState): SeatId | null {
  if (
    state.currentSeatId &&
    state.players.some((player) => playerSeatId(player) === state.currentSeatId)
  ) {
    return state.currentSeatId;
  }

  return null;
}

export function resolveCurrentPlayerIndex(state: CurrentTurnState): number {
  const currentSeatId = resolveCurrentSeatId(state);
  if (currentSeatId) {
    const currentIndex = state.players.findIndex(
      (player) => playerSeatId(player) === currentSeatId,
    );
    if (currentIndex !== -1) {
      return currentIndex;
    }
  }

  return -1;
}

export function resolveCurrentPlayer(
  state: CurrentTurnState,
): DomainPlayer | null {
  const currentPlayerIndex = resolveCurrentPlayerIndex(state);
  return currentPlayerIndex === -1
    ? null
    : (state.players[currentPlayerIndex] ?? null);
}

export function setCurrentSeat(
  state: CurrentTurnState,
  seatId: string | null,
): DomainPlayer | null {
  if (seatId === null) {
    state.currentSeatId = null;
    return null;
  }

  const canonicalSeatId = asSeatId(seatId);
  const currentPlayerIndex = state.players.findIndex(
    (player) => playerSeatId(player) === canonicalSeatId,
  );
  if (currentPlayerIndex === -1) {
    throw new Error(`Current seat ${seatId} is not in the game roster`);
  }

  const currentPlayer = state.players[currentPlayerIndex];
  state.currentSeatId = canonicalSeatId;
  return currentPlayer;
}
