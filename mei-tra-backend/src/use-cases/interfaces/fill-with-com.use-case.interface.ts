import { Room } from '../../types/room.types';
import type { SeatId } from '../../types/identity.types';

export interface FillWithComRequest {
  roomId: string;
  actorSeatId: SeatId;
}

export interface FillWithComResponse {
  success: boolean;
  error?: string;
  updatedRoom?: Room;
}

export interface IFillWithComUseCase {
  execute(request: FillWithComRequest): Promise<FillWithComResponse>;
}
