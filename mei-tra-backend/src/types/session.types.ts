import type { SeatId } from './identity.types';

export interface SessionUser {
  socketId: string;
  seatId?: SeatId;
  name: string;
  userId?: string;
  isAuthenticated?: boolean;
}

export interface PlayerConnectionState {
  socketId: string;
  userId?: string;
  isAuthenticated?: boolean;
}
