import type { SeatId } from '../types/identity.types';
import type { RoomPlayer } from '../types/room.types';

/**
 * A seat's owner is the person playing it, or the person COM is holding it
 * for. COM holds a seat by carrying its owner's identity: a COM seat with a
 * userId belongs to someone who left and can take it back by rejoining. A COM
 * seat without one is free for anybody.
 */
export type SeatOwner = Pick<
  RoomPlayer,
  'userId' | 'isAuthenticated' | 'participantKey'
>;

interface OwnedSeat {
  seatId: SeatId;
  isCOM?: boolean;
  userId?: string | null;
}

export function ownsSeat(player: Omit<OwnedSeat, 'seatId'>): boolean {
  return !player.isCOM || Boolean(player.userId);
}

export function holdSeatFor(comSeat: SeatOwner, owner: SeatOwner): void {
  comSeat.userId = owner.userId;
  comSeat.isAuthenticated = owner.isAuthenticated;
  comSeat.participantKey = owner.participantKey;
}

/**
 * The last person to leave a game in progress keeps their seat, so the game
 * waits for them instead of being deleted or played out by COM.
 */
export function isLastPersonAtTable(
  players: readonly OwnedSeat[],
  seatId: SeatId,
): boolean {
  return players.every((player) => player.isCOM || player.seatId === seatId);
}

/**
 * A game someone left keeps going only while a person is playing it. When
 * every seat owner has gone, COM waits for one of them to come back instead of
 * finishing the game alone.
 */
export function isWaitingForAbsentOwner(
  players: readonly OwnedSeat[],
  isConnected: (seatId: SeatId) => boolean,
): boolean {
  const someoneOwnsASeat = players.some(ownsSeat);
  const someoneIsPlaying = players.some(
    (player) => !player.isCOM && isConnected(player.seatId),
  );
  return someoneOwnsASeat && !someoneIsPlaying;
}
