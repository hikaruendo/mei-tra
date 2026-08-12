import type {
  CompletedFieldContract,
  GameStartedPayload,
  GameStatePayload,
  PlayerContract,
  TransportTeamScores,
} from '@meitra/contracts/game';
import type { RoomContract } from '@meitra/contracts/room';
import { asSeatId } from '@meitra/contracts/ids';
import {
  type CanonicalBlowState,
  type CanonicalCompletedFieldContract,
  normalizeCompletedFieldIdentity,
  normalizeGameStateIdentity,
  normalizePlayerIdentities,
  normalizeRoomIdentity,
} from '@meitra/game-client/identity';

import type {
  MobileGameSnapshot,
  MobilePlayer,
  MobileRoom,
} from '@/types/game';

export const createEmptyScores = (): TransportTeamScores => ({
  0: { play: 0, total: 0 },
  1: { play: 0, total: 0 },
});

export const createEmptyBlowState = (): CanonicalBlowState => ({
  currentTrump: null,
  currentHighestDeclaration: null,
  declarations: [],
  actionHistory: [],
  lastPasserSeatId: null,
  lastPasser: null,
  isRoundCancelled: false,
  currentBlowIndex: 0,
});

export const mergePlayersByIdentity = (
  previous: MobilePlayer[],
  next: PlayerContract[],
): MobilePlayer[] => {
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
): CanonicalCompletedFieldContract[] => {
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
    .map((p) => p.playerId);

export const createStartedGameSnapshot = (
  payload: GameStartedPayload,
  currentPlayerId: string | null,
  hostId: string | null,
): MobileGameSnapshot => {
  const players = normalizePlayerIdentities(payload.players);
  const youSeatId = currentPlayerId ? asSeatId(currentPlayerId) : null;
  const hostSeatId = hostId ? asSeatId(hostId) : null;
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

export const inferNextTurnAfterCardPlayed = (
  players: MobilePlayer[],
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
