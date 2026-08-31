import { toJson, toJsonObject } from './json-value';

describe('JSON value conversion', () => {
  it('converts nested plain values and omits undefined object fields', () => {
    expect(
      toJsonObject({
        roomId: 'room-1',
        optional: undefined,
        players: [{ seatId: 'seat-1', active: true }],
      }),
    ).toEqual({
      roomId: 'room-1',
      players: [{ seatId: 'seat-1', active: true }],
    });
  });

  it('rejects values that would silently serialize incorrectly', () => {
    expect(() => toJson(new Date('2026-08-31T00:00:00.000Z'))).toThrow(
      'Value is not JSON serializable',
    );
    expect(() => toJson(Symbol('invalid'))).toThrow(
      'Value is not JSON serializable',
    );
  });
});
