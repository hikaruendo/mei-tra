import type {
  BlowStateContract,
  CompletedFieldContract,
  GameStartedPayload,
  GameStatePayload,
  PlayerContract,
  TransportTeamScores,
} from '@meitra/contracts/game';
import type { RoomContract } from '@meitra/contracts/room';

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
  const previousByPlayerId = new Map(
    previous.map((player) => [player.playerId, player]),
  );

  return next.map((player) => {
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
  return fields.filter((field) => {
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
  if (game?.you) return game.you;
  if (!authenticatedUserId) return null;

  return (
    room?.players.find((player) => player.userId === authenticatedUserId)
      ?.playerId ?? null
  );
};

export const normalizeGameStatePayload = (
  payload: GameStatePayload,
): MobileGameSnapshot => ({
  ...payload,
  isSpectator: Boolean(payload.isSpectator),
  negriPlayerId: null,
  revealedAgari: payload.revealedAgari ?? null,
  hostId: payload.hostId ?? null,
  paused: false,
  fields: dedupeCompletedFields(payload.fields),
  disconnectedPlayerIds: extractDisconnectedPlayerIds(payload.players),
  idlePlayerIds: [],
  teamNames: payload.teamNames,
});

export const extractDisconnectedPlayerIds = (
  players: PlayerContract[],
): string[] =>
  players
    .filter((p) => !p.isCOM && !p.socketId)
    .map((p) => p.playerId);

export const createStartedGameSnapshot = (
  payload: GameStartedPayload,
  currentPlayerId: string | null,
  hostId: string | null,
): MobileGameSnapshot => ({
  roomId: payload.roomId,
  players: payload.players,
  gamePhase: 'blow',
  currentField: null,
  currentTurn: null,
  blowState: createEmptyBlowState(),
  teamScores: createEmptyScores(),
  you: currentPlayerId,
  isSpectator: false,
  negriCard: null,
  negriPlayerId: null,
  revealedAgari: null,
  fields: [],
  hostId,
  pointsToWin: payload.pointsToWin,
  paused: false,
  disconnectedPlayerIds: [],
  idlePlayerIds: [],
  teamNames: payload.teamNames,
});

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
