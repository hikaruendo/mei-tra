import {
  DomainPlayer,
  PlayerConnectionMetadata,
  PlayerGameplayState,
} from '../types/game.types';
import { RoomPlayer } from '../types/room.types';
import { SessionUser } from '../types/session.types';
import { asSeatId } from '../types/identity.types';
import type { SeatId } from '../types/identity.types';
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
  SeatId,
  PersistedPlayerGameplayState
>;

export type TransportPlayer = PlayerContract;

export function toDomainPlayer(
  player: Pick<
    RoomPlayer | DomainPlayer,
    'seatId' | 'name' | 'team' | 'isCOM'
  > &
    Partial<PlayerGameplayState>,
): DomainPlayer {
  const seatId = player.seatId;
  return {
    seatId,
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
    seatId: domainPlayer.seatId,
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
      seatId: SeatId,
    ) => Partial<PlayerConnectionMetadata> | null | undefined;
    roomPlayers?: RoomPlayer[];
    mapHand?: (player: DomainPlayer) => string[];
  },
): TransportPlayer[] {
  const roomPlayersBySeatId = new Map(
    (options?.roomPlayers ?? []).map((roomPlayer) => [
      roomPlayer.seatId,
      roomPlayer,
    ]),
  );

  return players.map((player) => {
    const roomPlayer = roomPlayersBySeatId.get(player.seatId);
    const transportPlayer = withConnectionMetadata(
      player,
      options?.getConnectionState?.(player.seatId) ?? roomPlayer,
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
      player.seatId,
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
    typeof player.seatId !== 'string' ||
    typeof player.name !== 'string'
  ) {
    return null;
  }

  const team = player.team ?? fallbackTeam;
  if (team !== 0 && team !== 1) {
    return null;
  }

  return {
    seatId: asSeatId(player.seatId),
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
  gameplay: PlayerGameplayState & Pick<DomainPlayer, 'name' | 'seatId'>;
  participantKey?: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}): RoomPlayer {
  const seatId = params.session.seatId ?? params.gameplay.seatId;
  return {
    socketId: params.session.socketId,
    seatId,
    participantKey: params.participantKey ?? params.session.userId ?? seatId,
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
