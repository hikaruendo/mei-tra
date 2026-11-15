import { asSeatId } from '../types/identity.types';
import { electHost, isHostSeatPlayedByCom } from './host-election';

const seat = (id: string, isCOM = false) => ({ seatId: asSeatId(id), isCOM });

describe('electHost', () => {
  it('prefers a connected human over one still reconnecting', () => {
    const connected = new Set(['b']);
    expect(
      electHost([seat('a'), seat('b'), seat('c', true)], (id) =>
        connected.has(id),
      ),
    ).toBe('b');
  });

  it('falls back to a disconnected human rather than a COM seat', () => {
    expect(electHost([seat('a', true), seat('b')], () => false)).toBe('b');
  });

  it('returns null when every seat is played by COM', () => {
    expect(
      electHost([seat('a', true), seat('b', true)], () => true),
    ).toBeNull();
  });
});

describe('isHostSeatPlayedByCom', () => {
  it('is false while a human holds the host seat', () => {
    expect(
      isHostSeatPlayedByCom({
        hostSeatId: asSeatId('a'),
        players: [seat('a'), seat('b', true)],
      }),
    ).toBe(false);
  });

  it('is true once the host seat has turned COM', () => {
    expect(
      isHostSeatPlayedByCom({
        hostSeatId: asSeatId('a'),
        players: [seat('a', true), seat('b')],
      }),
    ).toBe(true);
  });

  it('is true when the host seat is gone from the roster', () => {
    expect(
      isHostSeatPlayedByCom({
        hostSeatId: asSeatId('gone'),
        players: [seat('b')],
      }),
    ).toBe(true);
  });
});
