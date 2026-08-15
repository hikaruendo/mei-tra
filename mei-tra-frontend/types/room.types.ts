import type {
  RoomContract,
  RoomPlayerContract,
  RoomStatusContract,
  RoomSyncPayload,
} from '@contracts/room';
import type { SeatId } from '@contracts/ids';
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
  return {
    socketId: player.socketId,
    seatId: player.seatId,
    name: player.name,
    userId: player.userId,
    isAuthenticated: player.isAuthenticated,
    team: player.team,
    hand: [...player.hand],
    isHost: player.isHost,
    isPasser: player.isPasser,
    isCOM: player.isCOM,
    hasBroken: player.hasBroken ?? false,
    hasRequiredBroken: player.hasRequiredBroken ?? false,
    isReady: player.isReady,
    joinedAt: new Date(player.joinedAt),
  };
}

export function fromRoomContract(room: RoomContract): Room {
  return {
    id: room.id,
    name: room.name,
    hostSeatId: room.hostSeatId,
    status: toRoomStatus(room.status),
    players: room.players.map(fromRoomPlayerContract),
    settings: {
      ...room.settings,
      password: room.settings.password ?? null,
    },
    createdAt: new Date(room.createdAt),
    updatedAt: new Date(room.updatedAt),
    lastActivityAt: new Date(room.lastActivityAt),
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
