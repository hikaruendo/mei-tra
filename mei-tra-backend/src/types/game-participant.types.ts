import type { SeatId } from './identity.types';

export interface GameParticipant {
  roomId: string;
  seatId: SeatId;
  userId: string | null;
  playerName: string;
  team: 0 | 1 | null;
  joinedAt: Date;
}
