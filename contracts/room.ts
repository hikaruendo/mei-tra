import type { PlayerContract, Team, TeamNames } from './game';
import type { SeatId } from './ids';

export type RoomStatusContract =
  | 'waiting'
  | 'ready'
  | 'playing'
  | 'finished'
  | 'abandoned';

export interface RoomPlayerContract extends PlayerContract {
  isReady: boolean;
  isHost: boolean;
  joinedAt: string;
}

export interface RoomSettingsContract {
  maxPlayers: number;
  isPrivate: boolean;
  password: string | null;
  teamAssignmentMethod: 'random' | 'host-choice';
  pointsToWin: number;
  allowSpectators: boolean;
  teamNames?: TeamNames;
}

export interface UpdateTeamNamesPayload {
  roomId: string;
  playerId: string;
  teamNames: TeamNames;
}

export interface RoomContract {
  id: string;
  name: string;
  hostSeatId?: SeatId;
  /** @deprecated Use hostSeatId. */
  hostId: string;
  status: RoomStatusContract;
  players: RoomPlayerContract[];
  settings: RoomSettingsContract;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface RoomSyncPayload {
  room: RoomContract;
  players: PlayerContract[];
}

export interface RoomPlayerJoinedPayload {
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  roomId: string;
  isHost: boolean;
}

export interface GamePlayerJoinedPayload {
  seatId?: SeatId;
  /** @deprecated Use seatId. */
  playerId: string;
  roomId: string;
  isHost: boolean;
  roomStatus?: RoomStatusContract;
  isSelf?: boolean;
  team?: Team;
  name?: string;
  isCOM?: boolean;
  isReady?: boolean;
}
