import type {
  BlowStateContract,
  CompletedFieldContract,
  GameStartedPayload,
  GameStatePayload,
  PlayerContract,
  TransportTeamScores,
} from '@meitra/contracts/game';
import type { RoomContract } from '@meitra/contracts/room';
import {
  normalizeCompletedFieldIdentity,
  normalizeGameStateIdentity,
  normalizePlayerIdentities,
  normalizeRoomIdentity,
  resolveSeatAlias,
} from '@meitra/game-client/identity';

import type { MobileGameSnapshot } from '@/types/game';

export const createEmptyScores = (): TransportTeamScores => ({
  0: { play: 0, total: 0 },
  1: { play: 0, total: 0 },
});

export const createEmptyBlowState = (): BlowStateContract => ({
  currentTrump: null,
  currentHighestDeclaration: null,
  declarations: [],
  actionHistory: [],
  lastPasser: null,
  isRoundCancelled: false,
  currentBlowIndex: 0,
});

export const mergePlayersByIdentity = (
  previous: PlayerContract[],
  next: PlayerContract[],
): PlayerContract[] => {
  const normalizedPrevious = normalizePlayerIdentities(previous);
  const normalizedNext = normalizePlayerIdentities(next);
  const previousByPlayerId = new Map(
    normalizedPrevious.map((player) => [player.playerId, player]),
  );

  return normalizedNext.map((player) => {
    const oldPlayer = previousByPlayerId.get(player.playerId);
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

export const dedupeCompletedFields = (
  fields: CompletedFieldContract[],
): CompletedFieldContract[] => {
  const seen = new Set<string>();
  return fields.map(normalizeCompletedFieldIdentity).filter((field) => {
    const key = [
      field.dealerId,
      field.winnerId,
      field.winnerTeam,
      field.cards.join(','),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const resolvePlayerId = (
  game: MobileGameSnapshot | null,
  room: RoomContract | null,
  authenticatedUserId?: string | null,
): string | null => {
  if (game?.youSeatId ?? game?.you) return game?.youSeatId ?? game?.you ?? null;
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
    .map((p) => p.playerId);

export const createStartedGameSnapshot = (
  payload: GameStartedPayload,
  currentPlayerId: string | null,
  hostId: string | null,
): MobileGameSnapshot => {
  const players = normalizePlayerIdentities(payload.players);
  const youSeatId = resolveSeatAlias(undefined, currentPlayerId);
  const hostSeatId = resolveSeatAlias(undefined, hostId);
  return {
  roomId: payload.roomId,
  players,
  gamePhase: 'blow',
  currentField: null,
  currentTurnSeatId: null,
  currentTurn: null,
  blowState: createEmptyBlowState(),
  teamScores: createEmptyScores(),
  youSeatId,
  you: youSeatId,
  isSpectator: false,
  negriCard: null,
  negriSeatId: null,
  negriPlayerId: null,
  revealedAgari: null,
  fields: [],
  hostSeatId,
  hostId: hostSeatId,
  pointsToWin: payload.pointsToWin,
  paused: false,
  disconnectedPlayerIds: [],
  idlePlayerIds: [],
  teamNames: payload.teamNames,
  };
};

export const inferNextTurnAfterCardPlayed = (
  players: PlayerContract[],
  field: { isComplete: boolean; cards: string[]; playedBy: string[]; baseCard: string; baseSuit?: string },
): string | null => {
  if (
    field.isComplete ||
    field.cards.length === 0 ||
    (field.baseCard === 'JOKER' && !field.baseSuit)
  ) {
    return null;
  }

  const lastPlayerId = field.playedBy[field.playedBy.length - 1];
  if (!lastPlayerId || players.length === 0) return null;

  const lastPlayerIndex = players.findIndex(
    (p) => p.playerId === lastPlayerId,
  );
  if (lastPlayerIndex === -1) return null;

  return players[(lastPlayerIndex + 1) % players.length]?.playerId ?? null;
};

export const shouldAckTurn = (
  game: MobileGameSnapshot | null,
  roomId: string | null | undefined,
): roomId is string => Boolean(roomId && game && !game.isSpectator);
