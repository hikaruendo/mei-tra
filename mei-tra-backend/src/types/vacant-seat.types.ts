import type { SeatId } from '@contracts/ids';
import type { DomainPlayer } from './game.types';
import type { RoomPlayer } from './room.types';

export interface VacantSeatSnapshot {
  roomPlayer: RoomPlayer;
  gamePlayer?: DomainPlayer;
}

export type RoomVacantSeats = Record<SeatId, VacantSeatSnapshot>;

export type VacantSeats = Record<string, RoomVacantSeats>;
