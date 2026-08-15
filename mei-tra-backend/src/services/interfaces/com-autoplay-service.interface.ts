import type { SeatId } from '../../types/identity.types';

export interface IComAutoPlayService {
  scheduleComTurn(
    roomId: string,
    seatId: SeatId,
    action: () => Promise<void>,
  ): void;
  clearComTurn(roomId: string, seatId: SeatId): void;
  clearRoomTimers(roomId: string): void;
}
