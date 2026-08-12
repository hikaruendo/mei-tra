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
import type { RoomContract } from '@meitra/contracts/room';

export type CanonicalPlayerContract<T extends ConnectionUserContract> = T & {
  seatId: SeatId;
  playerId: SeatId;
};

export type CanonicalRoomContract = Omit<RoomContract, 'players'> & {
  hostId: SeatId;
  players: Array<CanonicalPlayerContract<RoomContract['players'][number]>>;
};

export type CanonicalBlowDeclaration = BlowDeclarationContract & {
  playerId: SeatId;
};

export type CanonicalBlowAction = BlowActionContract & {
  playerId: SeatId;
};

export type CanonicalBlowState = Omit<
  BlowStateContract,
  'currentHighestDeclaration' | 'declarations' | 'actionHistory'
> & {
  currentHighestDeclaration: CanonicalBlowDeclaration | null;
  declarations: CanonicalBlowDeclaration[];
  actionHistory: CanonicalBlowAction[];
  lastPasser: SeatId | null;
};

export type CanonicalFieldContract = FieldContract & {
  playedBy: SeatId[];
  dealerId: SeatId;
};

export type CanonicalCompletedFieldContract = CompletedFieldContract & {
  winnerId: SeatId;
  dealerId: SeatId;
};

export type CanonicalGameStatePayload = Omit<
  GameStatePayload,
  | 'players'
  | 'blowState'
  | 'currentField'
  | 'fields'
> & {
  players: Array<CanonicalPlayerContract<GameStatePayload['players'][number]>>;
  blowState: CanonicalBlowState;
  currentField: CanonicalFieldContract | null;
  fields: CanonicalCompletedFieldContract[];
};

export const normalizePlayerIdentity = <T extends ConnectionUserContract>(
  player: T,
): CanonicalPlayerContract<T> => {
  return {
    ...player,
    playerId: player.seatId,
  };
};

export const normalizePlayerIdentities = <T extends ConnectionUserContract>(
  players: T[],
): Array<CanonicalPlayerContract<T>> =>
  players.map(normalizePlayerIdentity);

export const normalizeBlowDeclarationIdentity = (
  declaration: BlowDeclarationContract,
): CanonicalBlowDeclaration => {
  return { ...declaration, playerId: declaration.seatId };
};

export const normalizeBlowActionIdentity = (
  action: BlowActionContract,
): CanonicalBlowAction => {
  return { ...action, playerId: action.seatId };
};

export const normalizeBlowStateIdentity = (
  blowState: BlowStateContract,
): CanonicalBlowState => {
  const declarations = (blowState.declarations ?? []).map(
    normalizeBlowDeclarationIdentity,
  );
  const actionHistory = (blowState.actionHistory ?? []).map(
    normalizeBlowActionIdentity,
  );
  const currentHighestDeclaration = blowState.currentHighestDeclaration
    ? normalizeBlowDeclarationIdentity(blowState.currentHighestDeclaration)
    : null;
  return {
    ...blowState,
    declarations,
    actionHistory,
    currentHighestDeclaration,
    lastPasser: blowState.lastPasserSeatId,
  };
};

export const normalizeFieldIdentity = (
  field: FieldContract,
): CanonicalFieldContract => {
  return {
    ...field,
    playedBy: [...field.playedBySeatIds],
    dealerId: field.dealerSeatId,
  };
};

export const normalizeCompletedFieldIdentity = (
  field: CompletedFieldContract,
): CanonicalCompletedFieldContract => {
  return {
    ...field,
    winnerId: field.winnerSeatId,
    dealerId: field.dealerSeatId,
  };
};

export const normalizeRoomIdentity = (
  room: RoomContract,
): CanonicalRoomContract => {
  const players = normalizePlayerIdentities(room.players);

  return {
    ...room,
    hostId: room.hostSeatId,
    players,
  };
};

export const normalizeGameStateIdentity = (
  payload: GameStatePayload,
): CanonicalGameStatePayload => {
  const blowState = normalizeBlowStateIdentity(payload.blowState);

  return {
    ...payload,
    players: normalizePlayerIdentities(payload.players),
    blowState,
    currentField: payload.currentField
      ? normalizeFieldIdentity(payload.currentField)
      : null,
    fields: payload.fields.map(normalizeCompletedFieldIdentity),
  };
};
