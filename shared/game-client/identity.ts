import type {
  BlowActionContract,
  BlowDeclarationContract,
  BlowStateContract,
  CompletedFieldContract,
  ConnectionUserContract,
  FieldContract,
  GameStatePayload,
} from '@meitra/contracts/game';
import type { SeatId } from '@meitra/contracts/ids';
import { asSeatId } from '@meitra/contracts/ids';
import type { RoomContract } from '@meitra/contracts/room';

export type CanonicalPlayerContract<T extends ConnectionUserContract> = T & {
  seatId: SeatId;
  playerId: SeatId;
};

export type CanonicalRoomContract = Omit<
  RoomContract,
  'hostSeatId' | 'hostId' | 'players'
> & {
  hostSeatId: SeatId;
  hostId: SeatId;
  players: Array<CanonicalPlayerContract<RoomContract['players'][number]>>;
};

export type CanonicalGameStatePayload = Omit<
  GameStatePayload,
  | 'players'
  | 'currentTurnSeatId'
  | 'currentTurn'
  | 'youSeatId'
  | 'you'
  | 'hostSeatId'
  | 'hostId'
  | 'negriSeatId'
  | 'negriPlayerId'
  | 'blowState'
  | 'currentField'
  | 'fields'
> & {
  players: Array<CanonicalPlayerContract<GameStatePayload['players'][number]>>;
  currentTurnSeatId: SeatId | null;
  currentTurn: SeatId | null;
  youSeatId: SeatId | null;
  you: SeatId | null;
  hostSeatId: SeatId | null;
  hostId: SeatId | null;
  negriSeatId: SeatId | null;
  negriPlayerId: SeatId | null;
  blowState: BlowStateContract;
  currentField: FieldContract | null;
  fields: CompletedFieldContract[];
};

export const resolveSeatAlias = (
  seatId: SeatId | string | null | undefined,
  legacyPlayerId: string | null | undefined,
): SeatId | null => {
  const value = seatId ?? legacyPlayerId;
  return value ? asSeatId(value) : null;
};

export const normalizePlayerIdentity = <T extends ConnectionUserContract>(
  player: T,
): CanonicalPlayerContract<T> => {
  const seatId = resolveSeatAlias(player.seatId, player.playerId);
  if (!seatId) {
    throw new Error('Player payload omitted both seatId and playerId');
  }

  return {
    ...player,
    seatId,
    playerId: seatId,
  };
};

export const normalizePlayerIdentities = <T extends ConnectionUserContract>(
  players: T[],
): Array<CanonicalPlayerContract<T>> =>
  players.map(normalizePlayerIdentity);

export const normalizeBlowDeclarationIdentity = (
  declaration: BlowDeclarationContract,
): BlowDeclarationContract & { seatId: SeatId; playerId: SeatId } => {
  const seatId = resolveSeatAlias(declaration.seatId, declaration.playerId)!;
  return { ...declaration, seatId, playerId: seatId };
};

export const normalizeBlowActionIdentity = (
  action: BlowActionContract,
): BlowActionContract & { seatId: SeatId; playerId: SeatId } => {
  const seatId = resolveSeatAlias(action.seatId, action.playerId)!;
  return { ...action, seatId, playerId: seatId };
};

export const normalizeBlowStateIdentity = (
  blowState: BlowStateContract,
): BlowStateContract => {
  const declarations = (blowState.declarations ?? []).map(
    normalizeBlowDeclarationIdentity,
  );
  const actionHistory = (blowState.actionHistory ?? []).map(
    normalizeBlowActionIdentity,
  );
  const currentHighestDeclaration = blowState.currentHighestDeclaration
    ? normalizeBlowDeclarationIdentity(blowState.currentHighestDeclaration)
    : null;
  const lastPasserSeatId = resolveSeatAlias(
    blowState.lastPasserSeatId,
    blowState.lastPasser,
  );

  return {
    ...blowState,
    declarations,
    actionHistory,
    currentHighestDeclaration,
    lastPasserSeatId,
    lastPasser: lastPasserSeatId,
  };
};

export const normalizeFieldIdentity = (field: FieldContract): FieldContract => {
  const playedBySeatIds = (field.playedBySeatIds ?? field.playedBy).map(
    (seatId) => asSeatId(seatId),
  );
  const dealerSeatId = resolveSeatAlias(field.dealerSeatId, field.dealerId)!;
  return {
    ...field,
    playedBy: playedBySeatIds,
    playedBySeatIds,
    dealerSeatId,
    dealerId: dealerSeatId,
  };
};

export const normalizeCompletedFieldIdentity = (
  field: CompletedFieldContract,
): CompletedFieldContract => {
  const winnerSeatId = resolveSeatAlias(field.winnerSeatId, field.winnerId)!;
  const dealerSeatId = resolveSeatAlias(field.dealerSeatId, field.dealerId)!;
  return {
    ...field,
    winnerSeatId,
    winnerId: winnerSeatId,
    dealerSeatId,
    dealerId: dealerSeatId,
  };
};

export const normalizeRoomIdentity = (
  room: RoomContract,
): CanonicalRoomContract => {
  const players = normalizePlayerIdentities(room.players);
  const hostSeatId = resolveSeatAlias(room.hostSeatId, room.hostId);
  if (!hostSeatId) {
    throw new Error(`Room payload omitted host identity: ${room.id}`);
  }

  return {
    ...room,
    hostSeatId,
    hostId: hostSeatId,
    players,
  };
};

export const normalizeGameStateIdentity = (
  payload: GameStatePayload,
): CanonicalGameStatePayload => {
  const currentTurnSeatId = resolveSeatAlias(
    payload.currentTurnSeatId,
    payload.currentTurn,
  );
  const youSeatId = resolveSeatAlias(payload.youSeatId, payload.you);
  const hostSeatId = resolveSeatAlias(payload.hostSeatId, payload.hostId);
  const blowState = normalizeBlowStateIdentity(payload.blowState);
  const negriSeatId =
    resolveSeatAlias(payload.negriSeatId, payload.negriPlayerId) ??
    (payload.negriCard && blowState.currentHighestDeclaration
      ? resolveSeatAlias(
          blowState.currentHighestDeclaration.seatId,
          blowState.currentHighestDeclaration.playerId,
        )
      : null);

  return {
    ...payload,
    players: normalizePlayerIdentities(payload.players),
    currentTurnSeatId,
    currentTurn: currentTurnSeatId,
    youSeatId,
    you: youSeatId,
    hostSeatId,
    hostId: hostSeatId,
    negriSeatId,
    negriPlayerId: negriSeatId,
    blowState,
    currentField: payload.currentField
      ? normalizeFieldIdentity(payload.currentField)
      : null,
    fields: payload.fields.map(normalizeCompletedFieldIdentity),
  };
};
