import type { PlayerContract, Team } from './game';

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
}

export interface RoomContract {
  id: string;
  name: string;
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
  playerId: string;
  roomId: string;
  isHost: boolean;
}

export interface GamePlayerJoinedPayload {
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
