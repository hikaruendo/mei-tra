import { PlayerGameplayState, TeamNames } from './game.types';
import type { SeatId } from './identity.types';
import { SessionUser } from './session.types';

export enum RoomStatus {
  WAITING = 'waiting',
  READY = 'ready',
  PLAYING = 'playing',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

export interface RoomPlayer extends SessionUser, PlayerGameplayState {
  /** @deprecated Use seatId. */
  playerId: string;
  participantKey?: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
  seatIndex?: number;
}

export interface Room {
  id: string;
  name: string;
  hostSeatId: SeatId;
  status: RoomStatus;
  players: RoomPlayer[];
  settings: RoomSettings;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  password: string | null;
  teamAssignmentMethod: 'random' | 'host-choice';
  pointsToWin: number;
  allowSpectators: boolean;
  teamNames?: TeamNames;
}
