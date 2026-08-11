declare const idBrand: unique symbol;

type BrandedId<TName extends string> = string & {
  readonly [idBrand]: TName;
};

export type SeatId = BrandedId<'SeatId'>;
export type UserId = BrandedId<'UserId'>;
export type RoomId = BrandedId<'RoomId'>;
export type SocketId = BrandedId<'SocketId'>;

export const asSeatId = (value: string): SeatId => value as SeatId;
export const asUserId = (value: string): UserId => value as UserId;
export const asRoomId = (value: string): RoomId => value as RoomId;
export const asSocketId = (value: string): SocketId => value as SocketId;
