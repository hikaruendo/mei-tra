import type { SeatId } from '../types/identity.types';

interface OwnedSeat {
  seatId: SeatId;
  isCOM?: boolean;
  userId?: string | null;
}

/**
 * A game someone left keeps going only while a person is playing it. When
 * every seat owner has gone, COM waits for one of them to come back instead of
 * finishing the game alone. A COM seat that still carries a userId is owned by
 * the person who left it.
 */
export function isWaitingForAbsentOwner(
  players: readonly OwnedSeat[],
  isConnected: (seatId: SeatId) => boolean,
): boolean {
  const someoneOwnsASeat = players.some(
    (player) => !player.isCOM || Boolean(player.userId),
  );
  const someoneIsPlaying = players.some(
    (player) => !player.isCOM && isConnected(player.seatId),
  );
  return someoneOwnsASeat && !someoneIsPlaying;
}
