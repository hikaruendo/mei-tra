import type {
  GameStartedPayload,
  GameStatePayload,
  PlayerContract,
  TransportTeamScores,
} from '@meitra/contracts/game';
import type { RoomContract } from '@meitra/contracts/room';
import { asSeatId } from '@meitra/contracts/ids';
import {
  normalizeGameStateIdentity,
  normalizePlayerIdentities,
  normalizeRoomIdentity,
} from '@meitra/game-client/identity';
import {
  createEmptyBlowState,
  dedupeCompletedFields,
} from '@meitra/game-client/game-event-reducer';
import type {
  MobileGameSnapshot,
  MobilePlayer,
  MobileRoom,
} from '@/types/game';

export {
  createEmptyBlowState,
  dedupeCompletedFields,
} from '@meitra/game-client/game-event-reducer';

export const createEmptyScores = (): TransportTeamScores => ({
  0: { play: 0, total: 0 },
  1: { play: 0, total: 0 },
});

export const mergePlayersByIdentity = (
  previous: MobilePlayer[],
  next: PlayerContract[],
): MobilePlayer[] => {
  const normalizedPrevious = normalizePlayerIdentities(previous);
  const normalizedNext = normalizePlayerIdentities(next);
  const previousByPlayerId = new Map(
    normalizedPrevious.map((player) => [player.seatId, player]),
  );

  return normalizedNext.map((player) => {
    const oldPlayer = previousByPlayerId.get(player.seatId);
    if (!oldPlayer || player.isCOM) {
      return player;
    }

    return {
      ...oldPlayer,
      ...player,
      userId: player.userId ?? oldPlayer.userId,
      name: player.name || oldPlayer.name,
      isHost: player.isHost ?? oldPlayer.isHost,
    };
  });
};

export const resolvePlayerId = (
  game: MobileGameSnapshot | null,
  room: MobileRoom | RoomContract | null,
  authenticatedUserId?: string | null,
): string | null => {
  if (game?.youSeatId) return game.youSeatId;
  if (!authenticatedUserId) return null;

  if (!room) return null;
  const normalizedRoom = normalizeRoomIdentity(room);
  return normalizedRoom.players.find(
    (player) => player.userId === authenticatedUserId,
  )?.seatId ?? null;
};

export const normalizeGameStatePayload = (
  payload: GameStatePayload,
): MobileGameSnapshot => {
  const normalized = normalizeGameStateIdentity(payload);
  return {
    ...normalized,
    isSpectator: Boolean(payload.isSpectator),
    revealedAgari: payload.revealedAgari ?? null,
    paused: false,
    fields: dedupeCompletedFields(normalized.fields),
    disconnectedPlayerIds: extractDisconnectedPlayerIds(normalized.players),
    idlePlayerIds: [],
    teamNames: payload.teamNames,
  };
};

export const extractDisconnectedPlayerIds = (
  players: PlayerContract[],
): string[] =>
  normalizePlayerIdentities(players)
    .filter((p) => !p.isCOM && !p.socketId)
    .map((p) => p.seatId);

export const createStartedGameSnapshot = (
  payload: GameStartedPayload,
  currentSeatId: string | null,
  hostSeatIdValue: string | null,
): MobileGameSnapshot => {
  const players = normalizePlayerIdentities(payload.players);
  const youSeatId = currentSeatId ? asSeatId(currentSeatId) : null;
  const hostSeatId = hostSeatIdValue ? asSeatId(hostSeatIdValue) : null;
  return {
    roomId: payload.roomId,
    players,
    gamePhase: 'blow',
    currentField: null,
    currentTurnSeatId: null,
    blowState: createEmptyBlowState(),
    teamScores: createEmptyScores(),
    youSeatId,
    isSpectator: false,
    negriCard: null,
    negriSeatId: null,
    revealedAgari: null,
    fields: [],
    hostSeatId,
    pointsToWin: payload.pointsToWin,
    paused: false,
    disconnectedPlayerIds: [],
    idlePlayerIds: [],
    teamNames: payload.teamNames,
  };
};

export const shouldAckTurn = (
  game: MobileGameSnapshot | null,
  roomId: string | null | undefined,
): roomId is string => Boolean(roomId && game && !game.isSpectator);
