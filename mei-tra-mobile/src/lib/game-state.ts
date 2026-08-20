import type {
  GameStartedPayload,
  GameStatePayload,
  PlayerContract,
  TransportTeamScores,
} from '@meitra/contracts/game';
import type { RoomContract } from '@meitra/contracts/room';
import { asSeatId } from '@meitra/contracts/ids';
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
  const previousBySeatId = new Map(
    previous.map((player) => [player.seatId, player]),
  );

  return next.map((player) => {
    const oldPlayer = previousBySeatId.get(player.seatId);
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

export const resolveSeatId = (
  game: MobileGameSnapshot | null,
  room: MobileRoom | RoomContract | null,
  authenticatedUserId?: string | null,
): string | null => {
  if (game?.youSeatId) return game.youSeatId;
  if (!authenticatedUserId) return null;

  if (!room) return null;
  return room.players.find(
    (player) => player.userId === authenticatedUserId,
  )?.seatId ?? null;
};

export const normalizeGameStatePayload = (
  payload: GameStatePayload,
): MobileGameSnapshot => {
  return {
    ...payload,
    isSpectator: Boolean(payload.isSpectator),
    revealedAgari: payload.revealedAgari ?? null,
    paused: false,
    fields: dedupeCompletedFields(payload.fields),
    disconnectedSeatIds: extractDisconnectedSeatIds(payload.players),
    idleSeatIds: [],
    teamNames: payload.teamNames,
  };
};

export const extractDisconnectedSeatIds = (
  players: PlayerContract[],
): string[] =>
  players.filter((p) => !p.isCOM && !p.socketId).map((p) => p.seatId);

export const createStartedGameSnapshot = (
  payload: GameStartedPayload,
  currentSeatId: string | null,
  hostSeatIdValue: string | null,
): MobileGameSnapshot => {
  const youSeatId = currentSeatId ? asSeatId(currentSeatId) : null;
  const hostSeatId = hostSeatIdValue ? asSeatId(hostSeatIdValue) : null;
  return {
    roomId: payload.roomId,
    players: payload.players,
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
    disconnectedSeatIds: [],
    idleSeatIds: [],
    teamNames: payload.teamNames,
  };
};

export const shouldAckTurn = (
  game: MobileGameSnapshot | null,
  roomId: string | null | undefined,
): roomId is string => Boolean(roomId && game && !game.isSpectator);
