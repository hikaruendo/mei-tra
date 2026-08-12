import {
  DomainPlayer,
  PlayerConnectionMetadata,
  PlayerGameplayState,
} from './game.types';
import { RoomPlayer } from './room.types';
import { SessionUser } from './session.types';
import { asSeatId, resolveSeatId } from './identity.types';
import type { PlayerContract } from '@contracts/game';

export type PersistedGamePlayer = DomainPlayer & {
  id?: string;
};

export interface PersistedPlayerGameplayState {
  hand: string[];
  isPasser: boolean;
  hasBroken: boolean;
  hasRequiredBroken: boolean;
}

export type PersistedPlayerStates = Record<
  string,
  PersistedPlayerGameplayState
>;

export type TransportPlayer = PlayerContract;

export function toDomainPlayer(
  player: Pick<
    RoomPlayer | DomainPlayer,
    'seatId' | 'playerId' | 'name' | 'team' | 'isCOM'
  > &
    Partial<PlayerGameplayState>,
): DomainPlayer {
  const seatId = resolveSeatId(player);
  return {
    seatId,
    playerId: seatId,
    name: player.name,
    hand: [...(player.hand ?? [])],
    team: player.team,
    isPasser: player.isPasser ?? false,
    isCOM: player.isCOM,
    hasBroken: player.hasBroken ?? false,
    hasRequiredBroken: player.hasRequiredBroken ?? false,
  };
}

export function withConnectionMetadata(
  player: DomainPlayer,
  connection?: Partial<PlayerConnectionMetadata>,
): TransportPlayer {
  const domainPlayer = toDomainPlayer(player);
  return {
    seatId: resolveSeatId(domainPlayer),
    name: domainPlayer.name,
    hand: [...domainPlayer.hand],
    team: domainPlayer.team,
    isPasser: domainPlayer.isPasser,
    isCOM: domainPlayer.isCOM,
    hasBroken: domainPlayer.hasBroken,
    hasRequiredBroken: domainPlayer.hasRequiredBroken,
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

    const visiblePlayer = roomPlayer?.isCOM
      ? {
          ...transportPlayer,
          socketId: roomPlayer.socketId,
          name: roomPlayer.name,
          userId: undefined,
          isAuthenticated: false,
          isCOM: true,
        }
      : transportPlayer;

    return {
      ...visiblePlayer,
      isHost: roomPlayer?.isHost,
      hand: options?.mapHand ? options.mapHand(player) : visiblePlayer.hand,
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

export function toPersistedPlayerStates(
  players: DomainPlayer[],
): PersistedPlayerStates {
  return Object.fromEntries(
    players.map((player) => [
      player.playerId,
      {
        hand: [...player.hand],
        isPasser: player.isPasser,
        hasBroken: player.hasBroken ?? false,
        hasRequiredBroken: player.hasRequiredBroken ?? false,
      },
    ]),
  );
}

export function toRuntimePlayer(
  player: Partial<PersistedGamePlayer> | null | undefined,
  fallbackTeam?: 0 | 1,
): DomainPlayer | null {
  if (
    !player ||
    typeof player.playerId !== 'string' ||
    typeof player.name !== 'string'
  ) {
    return null;
  }

  const team = player.team ?? fallbackTeam;
  if (team !== 0 && team !== 1) {
    return null;
  }

  const seatId = player.seatId ?? asSeatId(player.playerId);
  return {
    seatId,
    playerId: seatId,
    name: player.name,
    hand: Array.isArray(player.hand) ? [...player.hand] : [],
    team,
    isPasser: player.isPasser ?? false,
    isCOM: player.isCOM,
    hasBroken: player.hasBroken ?? false,
    hasRequiredBroken: player.hasRequiredBroken ?? false,
  };
}

export function toRoomPlayer(params: {
  session: SessionUser;
  gameplay: PlayerGameplayState &
    Pick<DomainPlayer, 'name' | 'playerId' | 'seatId'>;
  participantKey?: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}): RoomPlayer {
  const seatId =
    params.session.seatId ??
    (params.gameplay.seatId
      ? params.gameplay.seatId
      : asSeatId(params.gameplay.playerId));
  return {
    socketId: params.session.socketId,
    seatId,
    playerId: seatId,
    participantKey:
      params.participantKey ?? params.session.userId ?? params.session.playerId,
    name: params.gameplay.name,
    userId: params.session.userId,
    isAuthenticated: params.session.isAuthenticated,
    hand: [],
    team: params.gameplay.team,
    isPasser: false,
    isCOM: params.gameplay.isCOM,
    hasBroken: false,
    hasRequiredBroken: false,
    isReady: params.isReady,
    isHost: params.isHost,
    joinedAt: params.joinedAt,
  };
}
