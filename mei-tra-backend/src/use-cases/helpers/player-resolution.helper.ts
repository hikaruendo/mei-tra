import { DomainPlayer, PlayerConnectionMetadata } from '../../types/game.types';
import { Room, RoomPlayer, RoomStatus } from '../../types/room.types';
import {
  toDomainPlayer,
  toTransportPlayers,
  TransportPlayer,
} from '../../types/player-adapters';
import { toRoomContract } from '../../types/room-adapters';
import { GatewayEvent } from '../interfaces/gateway-event.interface';
import type { RoomSyncPayload } from '@contracts/room';

type PlayerResolutionSource = {
  findPlayerByActorId: (actorId: string) => DomainPlayer | null;
  findPlayerBySocketId: (socketId: string) => DomainPlayer | null;
};

type TransportPlayerSource = PlayerResolutionSource & {
  getTransportPlayers?: (
    players?: DomainPlayer[],
    roomPlayers?: RoomPlayer[],
  ) => TransportPlayer[];
  getPlayerConnectionState?: (
    playerId: string,
  ) => Partial<PlayerConnectionMetadata> | null;
};

export function resolvePlayerByActorId(
  source: PlayerResolutionSource,
  actorId: string,
): DomainPlayer | null {
  return source.findPlayerByActorId(actorId);
}

export function resolvePlayerBySocketId(
  source: PlayerResolutionSource,
  socketId: string,
): DomainPlayer | null {
  return source.findPlayerBySocketId(socketId);
}

export function resolveTransportPlayers(
  source: TransportPlayerSource,
  players: DomainPlayer[],
  options?: {
    roomPlayers?: RoomPlayer[];
    mapHand?: (player: TransportPlayer) => string[];
  },
): TransportPlayer[] {
  const transportPlayers =
    typeof source.getTransportPlayers === 'function'
      ? source.getTransportPlayers(players, options?.roomPlayers)
      : toTransportPlayers(players, {
          getConnectionState: (playerId) =>
            source.getPlayerConnectionState?.(playerId),
          roomPlayers: options?.roomPlayers,
        });

  if (!options?.mapHand) {
    return transportPlayers;
  }

  return transportPlayers.map((player) => ({
    ...player,
    hand: options.mapHand!(player),
  }));
}

export function resolveRoomTransportPlayers(
  source: TransportPlayerSource,
  room: Pick<Room, 'status' | 'players'>,
  options?: {
    statePlayers?: DomainPlayer[];
    mapHand?: (player: TransportPlayer) => string[];
  },
): TransportPlayer[] {
  const fallbackPlayers =
    room.status === RoomStatus.WAITING
      ? room.players.map((player) => toDomainPlayer(player))
      : options?.statePlayers && options.statePlayers.length > 0
        ? options.statePlayers
        : room.players
            .filter((player) => !player.isCOM)
            .map((player) => toDomainPlayer(player));

  return resolveTransportPlayers(source, fallbackPlayers, {
    roomPlayers: room.players,
    mapHand: options?.mapHand,
  });
}

export function buildRoomSyncEvent(
  source: TransportPlayerSource,
  room: Room,
  players: DomainPlayer[],
): GatewayEvent {
  const transportPlayers = resolveTransportPlayers(source, players, {
    roomPlayers: room.players,
  });
  const payload: RoomSyncPayload = {
    room: toRoomContract(room, { players: transportPlayers }),
    players: transportPlayers,
  };

  return {
    scope: 'room',
    roomId: room.id,
    event: 'room-sync',
    payload,
  };
}

export function buildRoomUpdatedEvent(
  source: TransportPlayerSource,
  room: Room,
  players: DomainPlayer[],
): GatewayEvent {
  const transportPlayers = resolveTransportPlayers(source, players, {
    roomPlayers: room.players,
  });

  return {
    scope: 'room',
    roomId: room.id,
    event: 'room-updated',
    payload: toRoomContract(room, { players: transportPlayers }),
  };
}

export function buildPlayerSyncEvents(
  source: TransportPlayerSource,
  roomId: string,
  players: DomainPlayer[],
  options?: {
    room?: Room | null;
    roomPlayers?: RoomPlayer[];
  },
): GatewayEvent[] {
  const transportPlayers = resolveTransportPlayers(source, players, {
    roomPlayers: options?.roomPlayers ?? options?.room?.players,
  });
  const events: GatewayEvent[] = [
    {
      scope: 'room',
      roomId,
      event: 'update-players',
      payload: transportPlayers,
    },
  ];

  if (options?.room) {
    events.push(buildRoomSyncEvent(source, options.room, players));
  }

  return events;
}
