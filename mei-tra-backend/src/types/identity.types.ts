import type { RoomId, SeatId, SocketId, UserId } from '@contracts/ids';
import { asRoomId, asSeatId, asSocketId, asUserId } from '@contracts/ids';

export type { RoomId, SeatId, SocketId, UserId };
export { asRoomId, asSeatId, asSocketId, asUserId };

export function resolveSeatId(identity: { seatId: SeatId }): SeatId {
  return identity.seatId;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
