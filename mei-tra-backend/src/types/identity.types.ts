import type { RoomId, SeatId, SocketId, UserId } from '@contracts/ids';
import { asRoomId, asSeatId, asSocketId, asUserId } from '@contracts/ids';

export type { RoomId, SeatId, SocketId, UserId };
export { asRoomId, asSeatId, asSocketId, asUserId };

export interface SeatIdentityAlias {
  seatId?: SeatId;
  playerId: string;
}

export function resolveSeatId(identity: SeatIdentityAlias): SeatId {
  return identity.seatId ?? asSeatId(identity.playerId);
}

export function withSeatAlias<T extends { playerId: string }>(
  value: T,
  seatId: SeatId = asSeatId(value.playerId),
): T & { seatId: SeatId; playerId: string } {
  return {
    ...value,
    seatId,
    playerId: seatId,
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
