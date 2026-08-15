import type {
  RoomContract,
  RoomPlayerContract,
  RoomStatusContract,
  RoomSyncPayload,
} from '@contracts/room';
import type { SeatId } from '@contracts/ids';
import {
  normalizePlayerIdentity,
  normalizeRoomIdentity,
} from '@meitra/game-client/identity';
import { Player, TeamNames, fromPlayerContracts } from './game.types';

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

export interface RoomPlayer extends Player {
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}

export interface RoomSettings {
  maxPlayers: number;
  isPrivate: boolean;
  password?: string | null;
  teamAssignmentMethod: 'random' | 'host-choice';
  pointsToWin: number;
  allowSpectators: boolean;
  teamNames?: TeamNames;
}

export enum RoomStatus {
  WAITING = 'waiting',
  READY = 'ready',
  PLAYING = 'playing',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

function toRoomStatus(status: RoomStatusContract): RoomStatus {
  return status as RoomStatus;
}

export function fromRoomPlayerContract(
  player: RoomPlayerContract,
): RoomPlayer {
  const normalized = normalizePlayerIdentity(player);
  return {
    socketId: normalized.socketId,
    seatId: normalized.seatId,
    name: normalized.name,
    userId: normalized.userId,
    isAuthenticated: normalized.isAuthenticated,
    team: normalized.team,
    hand: [...normalized.hand],
    isHost: normalized.isHost,
    isPasser: normalized.isPasser,
    isCOM: normalized.isCOM,
    hasBroken: normalized.hasBroken ?? false,
    hasRequiredBroken: normalized.hasRequiredBroken ?? false,
    isReady: normalized.isReady,
    joinedAt: new Date(normalized.joinedAt),
  };
}

export function fromRoomContract(room: RoomContract): Room {
  const normalized = normalizeRoomIdentity(room);
  return {
    id: normalized.id,
    name: normalized.name,
    hostSeatId: normalized.hostSeatId!,
    status: toRoomStatus(normalized.status),
    players: normalized.players.map(fromRoomPlayerContract),
    settings: {
      ...normalized.settings,
      password: normalized.settings.password ?? null,
    },
    createdAt: new Date(normalized.createdAt),
    updatedAt: new Date(normalized.updatedAt),
    lastActivityAt: new Date(normalized.lastActivityAt),
  };
}

export function fromRoomContracts(rooms: RoomContract[]): Room[] {
  return rooms.map(fromRoomContract);
}

export function fromRoomSyncPayload(payload: RoomSyncPayload): {
  room: Room;
  players: Player[];
} {
  return {
    room: fromRoomContract(payload.room),
    players: fromPlayerContracts(payload.players),
  };
}
