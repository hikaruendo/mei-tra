import type { DomainPlayer, GameState } from '../types/game.types';
import { resolveSeatId } from '../types/identity.types';
import { toDomainPlayer } from '../types/player-adapters';
import type { Room, RoomPlayer } from '../types/room.types';

type RuntimeRoomRoster = Pick<Room, 'players'>;
type RuntimeGameRoster = Pick<GameState, 'players' | 'teamAssignments'>;

interface UpsertRuntimeSeatOptions {
  replaceSeatId?: string;
  gameplaySource?: DomainPlayer | null;
}

export interface RuntimeSeatProjection {
  roomPlayer: RoomPlayer;
  gamePlayer: DomainPlayer;
}

function replaceOrAppend<T>(items: T[], index: number, value: T): void {
  if (index === -1) {
    items.push(value);
    return;
  }

  items[index] = value;
}

export function rebuildTeamAssignments(state: RuntimeGameRoster): void {
  state.teamAssignments = Object.fromEntries(
    state.players.map((player) => [player.playerId, player.team]),
  );
}

function projectGamePlayer(
  roomPlayer: RoomPlayer,
  gameplaySource?: DomainPlayer | null,
): DomainPlayer {
  return toDomainPlayer({
    ...roomPlayer,
    hand: [...(gameplaySource?.hand ?? [])],
    isPasser: gameplaySource?.isPasser ?? false,
    hasBroken: gameplaySource?.hasBroken ?? false,
    hasRequiredBroken: gameplaySource?.hasRequiredBroken ?? false,
  });
}

export function upsertRuntimeSeat(
  room: RuntimeRoomRoster,
  state: RuntimeGameRoster,
  roomPlayer: RoomPlayer,
  options: UpsertRuntimeSeatOptions = {},
): RuntimeSeatProjection {
  const seatId = resolveSeatId(roomPlayer);
  const replaceSeatId = options.replaceSeatId ?? seatId;

  if (replaceSeatId !== seatId) {
    throw new Error(
      `Cannot replace seat ${replaceSeatId} with a different seat ${seatId}`,
    );
  }

  const roomIndex = room.players.findIndex(
    (player) => resolveSeatId(player) === seatId,
  );
  const gameIndex = state.players.findIndex(
    (player) => resolveSeatId(player) === seatId,
  );
  const gameplaySource =
    options.gameplaySource ??
    (gameIndex === -1 ? null : state.players[gameIndex]);
  const normalizedRoomPlayer: RoomPlayer = {
    ...roomPlayer,
    seatId,
    playerId: seatId,
    hand: [],
    isPasser: false,
    hasBroken: false,
    hasRequiredBroken: false,
  };
  const gamePlayer = projectGamePlayer(normalizedRoomPlayer, gameplaySource);

  replaceOrAppend(room.players, roomIndex, normalizedRoomPlayer);
  replaceOrAppend(state.players, gameIndex, gamePlayer);
  rebuildTeamAssignments(state);

  return { roomPlayer: normalizedRoomPlayer, gamePlayer };
}

export function reconcileRuntimeRoster(
  state: RuntimeGameRoster,
  roomPlayers: RoomPlayer[],
): void {
  const currentPlayers = new Map(
    state.players.map((player) => [resolveSeatId(player), player]),
  );

  state.players = roomPlayers.map((roomPlayer) =>
    projectGamePlayer(
      roomPlayer,
      currentPlayers.get(resolveSeatId(roomPlayer)) ?? null,
    ),
  );
  rebuildTeamAssignments(state);
}
