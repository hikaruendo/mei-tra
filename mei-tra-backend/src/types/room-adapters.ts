import type { RoomContract, RoomPlayerContract } from '@contracts/room';
import { Room, RoomPlayer } from './room.types';
import { TransportPlayer } from './player-adapters';

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

export function toRoomPlayerContract(
  roomPlayer: RoomPlayer,
  transportPlayer?: Partial<TransportPlayer>,
): RoomPlayerContract {
  return {
    socketId: transportPlayer?.socketId ?? roomPlayer.socketId,
    playerId: roomPlayer.playerId,
    name: transportPlayer?.name ?? roomPlayer.name,
    userId: transportPlayer?.userId ?? roomPlayer.userId,
    isAuthenticated:
      transportPlayer?.isAuthenticated ?? roomPlayer.isAuthenticated,
    team: transportPlayer?.team ?? roomPlayer.team,
    hand: transportPlayer?.hand ?? [...roomPlayer.hand],
    isHost: roomPlayer.isHost,
    isPasser: transportPlayer?.isPasser ?? roomPlayer.isPasser,
    isCOM: transportPlayer?.isCOM ?? roomPlayer.isCOM,
    hasBroken: transportPlayer?.hasBroken ?? roomPlayer.hasBroken ?? false,
    hasRequiredBroken:
      transportPlayer?.hasRequiredBroken ??
      roomPlayer.hasRequiredBroken ??
      false,
    isReady: roomPlayer.isReady,
    joinedAt: toIsoString(roomPlayer.joinedAt),
  };
}

export function toRoomContract(
  room: Room,
  options?: { players?: TransportPlayer[] },
): RoomContract {
  const transportPlayersById = new Map(
    (options?.players ?? []).map((player) => [player.playerId, player]),
  );

  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((roomPlayer) =>
      toRoomPlayerContract(
        roomPlayer,
        transportPlayersById.get(roomPlayer.playerId),
      ),
    ),
    settings: {
      ...room.settings,
      password: room.settings.password ?? null,
    },
    createdAt: toIsoString(room.createdAt),
    updatedAt: toIsoString(room.updatedAt),
    lastActivityAt: toIsoString(room.lastActivityAt),
  };
}

export function toRoomContracts(rooms: Room[]): RoomContract[] {
  return rooms.map((room) => toRoomContract(room));
}
