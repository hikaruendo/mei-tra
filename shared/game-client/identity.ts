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
};

export type CanonicalRoomContract = Omit<RoomContract, 'players'> & {
  players: Array<CanonicalPlayerContract<RoomContract['players'][number]>>;
};

export type CanonicalBlowDeclaration = BlowDeclarationContract;

export type CanonicalBlowAction = BlowActionContract;

export type CanonicalBlowState = Omit<
  BlowStateContract,
  'currentHighestDeclaration' | 'declarations' | 'actionHistory'
> & {
  currentHighestDeclaration: CanonicalBlowDeclaration | null;
  declarations: CanonicalBlowDeclaration[];
  actionHistory: CanonicalBlowAction[];
};

export type CanonicalFieldContract = FieldContract;

export type CanonicalCompletedFieldContract = CompletedFieldContract;

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
  return { ...player };
};

export const normalizePlayerIdentities = <T extends ConnectionUserContract>(
  players: T[],
): Array<CanonicalPlayerContract<T>> =>
  players.map(normalizePlayerIdentity);

export const normalizeBlowDeclarationIdentity = (
  declaration: BlowDeclarationContract,
): CanonicalBlowDeclaration => {
  return { ...declaration };
};

export const normalizeBlowActionIdentity = (
  action: BlowActionContract,
): CanonicalBlowAction => {
  return { ...action };
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
  };
};

export const normalizeFieldIdentity = (
  field: FieldContract,
): CanonicalFieldContract => {
  return { ...field, playedBySeatIds: [...field.playedBySeatIds] };
};

export const normalizeCompletedFieldIdentity = (
  field: CompletedFieldContract,
): CanonicalCompletedFieldContract => {
  return { ...field };
};

export const normalizeRoomIdentity = (
  room: RoomContract,
): CanonicalRoomContract => {
  const players = normalizePlayerIdentities(room.players);

  return {
    ...room,
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
