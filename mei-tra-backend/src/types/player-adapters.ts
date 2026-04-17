import {
  DomainPlayer,
  PlayerConnectionMetadata,
  PlayerGameplayState,
} from './game.types';
import { RoomPlayer } from './room.types';
import { SessionUser } from './session.types';

export type PersistedGamePlayer = DomainPlayer & {
  id?: string;
};

export type TransportPlayer = DomainPlayer &
  PlayerConnectionMetadata & {
    isHost?: boolean;
  };

export function toDomainPlayer(
  player: Pick<
    RoomPlayer | DomainPlayer,
    | 'playerId'
    | 'name'
    | 'hand'
    | 'team'
    | 'isPasser'
    | 'isCOM'
    | 'hasBroken'
    | 'hasRequiredBroken'
  >,
): DomainPlayer {
  return {
    playerId: player.playerId,
    name: player.name,
    hand: [...player.hand],
    team: player.team,
    isPasser: player.isPasser,
    isCOM: player.isCOM,
    hasBroken: player.hasBroken ?? false,
    hasRequiredBroken: player.hasRequiredBroken ?? false,
  };
}

export function withConnectionMetadata(
  player: DomainPlayer,
  connection?: Partial<PlayerConnectionMetadata>,
): TransportPlayer {
  return {
    ...toDomainPlayer(player),
    socketId: connection?.socketId ?? '',
    userId: connection?.userId,
    isAuthenticated: connection?.isAuthenticated,
  };
}

export function toTransportPlayers(
  players: DomainPlayer[],
  options?: {
    getConnectionState?: (
      playerId: string,
    ) => Partial<PlayerConnectionMetadata> | null | undefined;
    roomPlayers?: RoomPlayer[];
    mapHand?: (player: DomainPlayer) => string[];
  },
): TransportPlayer[] {
  const roomPlayersById = new Map(
    (options?.roomPlayers ?? []).map((roomPlayer) => [
      roomPlayer.playerId,
      roomPlayer,
    ]),
  );

  return players.map((player) => {
    const roomPlayer = roomPlayersById.get(player.playerId);
    const transportPlayer = withConnectionMetadata(
      player,
      options?.getConnectionState?.(player.playerId) ?? roomPlayer,
    );

    return {
      ...transportPlayer,
      isHost: roomPlayer?.isHost,
      hand: options?.mapHand ? options.mapHand(player) : transportPlayer.hand,
    };
  });
}

export function toPersistedGamePlayer(
  player: DomainPlayer | RoomPlayer,
): PersistedGamePlayer {
  return {
    ...toDomainPlayer(player),
  };
}

export function toRuntimePlayer(
  player: Partial<PersistedGamePlayer> | null | undefined,
): DomainPlayer | null {
  if (
    !player ||
    typeof player.playerId !== 'string' ||
    typeof player.name !== 'string'
  ) {
    return null;
  }

  return {
    playerId: player.playerId,
    name: player.name,
    hand: Array.isArray(player.hand) ? [...player.hand] : [],
    team: player.team ?? 0,
    isPasser: player.isPasser ?? false,
    isCOM: player.isCOM,
    hasBroken: player.hasBroken ?? false,
    hasRequiredBroken: player.hasRequiredBroken ?? false,
  };
}

export function toRoomPlayer(params: {
  session: SessionUser;
  gameplay: PlayerGameplayState & Pick<DomainPlayer, 'name' | 'playerId'>;
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}): RoomPlayer {
  return {
    socketId: params.session.socketId,
    playerId: params.session.playerId,
    name: params.gameplay.name,
    userId: params.session.userId,
    isAuthenticated: params.session.isAuthenticated,
    hand: [...params.gameplay.hand],
    team: params.gameplay.team,
    isPasser: params.gameplay.isPasser,
    isCOM: params.gameplay.isCOM,
    hasBroken: params.gameplay.hasBroken ?? false,
    hasRequiredBroken: params.gameplay.hasRequiredBroken ?? false,
    isReady: params.isReady,
    isHost: params.isHost,
    joinedAt: params.joinedAt,
  };
}
