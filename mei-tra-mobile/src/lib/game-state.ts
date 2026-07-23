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
  revealedAgari: null,
  hostId: payload.hostId ?? null,
  paused: false,
  fields: dedupeCompletedFields(payload.fields),
});

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
});

export const shouldAckTurn = (
  game: MobileGameSnapshot | null,
  roomId: string | null | undefined,
): roomId is string => Boolean(roomId && game && !game.isSpectator);
