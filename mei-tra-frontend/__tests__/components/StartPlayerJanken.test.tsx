import { act, renderHook } from '@testing-library/react';
import { GAME_START_TURN_REVEAL_DELAY_MS } from '@contracts/game';
import { useFirstTurnReveal } from '@/components/game/StartPlayerJanken/useFirstTurnReveal';
import type { FirstTurnReveal } from '@/types/game.types';

const SEAT_IDS = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];

// token is stamped per test: a reveal older than the animation window is
// treated as stale and completes immediately.
const makeReveal = (): FirstTurnReveal => ({
  roomId: 'room-1',
  seatId: 'seat-2',
  lastBlowSeatId: 'seat-1',
  token: Date.now(),
});

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

describe('useFirstTurnReveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs through the chant and lands on the first turn seat', () => {
    const onDone = jest.fn();
    const reveal = makeReveal();
    const { result } = renderHook(() =>
      useFirstTurnReveal({ reveal, seatIds: SEAT_IDS, onDone }),
    );

    expect(result.current.step?.kind).toBe('chant');
    expect(result.current.highlightSeatId).toBeNull();

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(result.current.step?.kind).toBe('ready');

    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(result.current.step?.kind).toBe('draw');

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(result.current.step?.kind).toBe('showdown');
    // Only the janken winner (吹き上げ) throws the winning hand.
    expect(result.current.step?.hands?.['seat-1']).not.toBe(
      result.current.step?.hands?.['seat-0'],
    );
    expect(result.current.step?.hands?.['seat-2']).toBe(
      result.current.step?.hands?.['seat-0'],
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(result.current.step?.kind).toBe('result');
    expect(result.current.highlightSeatId).toBe('seat-2');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('finishes before the server releases the turn', () => {
    const onDone = jest.fn();
    const reveal = makeReveal();
    renderHook(() => useFirstTurnReveal({ reveal, seatIds: SEAT_IDS, onDone }));

    act(() => {
      jest.advanceTimersByTime(GAME_START_TURN_REVEAL_DELAY_MS);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips straight to the result when motion is reduced', () => {
    mockReducedMotion(true);
    const onDone = jest.fn();
    const reveal = makeReveal();
    const { result } = renderHook(() =>
      useFirstTurnReveal({ reveal, seatIds: SEAT_IDS, onDone }),
    );

    expect(result.current.step?.kind).toBe('result');
    expect(result.current.highlightSeatId).toBe('seat-2');

    // Static, but held for the full script length so the turn indicator
    // arrives right as it ends.
    act(() => {
      jest.advanceTimersByTime(4_200);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('completes immediately instead of replaying a stale reveal', () => {
    const onDone = jest.fn();
    const staleReveal = { ...makeReveal(), token: Date.now() - 60_000 };
    const { result } = renderHook(() =>
      useFirstTurnReveal({ reveal: staleReveal, seatIds: SEAT_IDS, onDone }),
    );

    expect(result.current.step).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stays idle and never completes without a reveal', () => {
    const onDone = jest.fn();
    const { result } = renderHook(() =>
      useFirstTurnReveal({ reveal: null, seatIds: SEAT_IDS, onDone }),
    );

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current.step).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('restarts when a new game start arrives', () => {
    const onDone = jest.fn();
    const { result, rerender } = renderHook(
      ({ current }: { current: FirstTurnReveal }) =>
        useFirstTurnReveal({ reveal: current, seatIds: SEAT_IDS, onDone }),
      { initialProps: { current: makeReveal() } },
    );

    act(() => {
      jest.advanceTimersByTime(GAME_START_TURN_REVEAL_DELAY_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    const nextReveal: FirstTurnReveal = {
      roomId: 'room-1',
      seatId: 'seat-0',
      lastBlowSeatId: 'seat-3',
      token: Date.now(),
    };
    rerender({ current: nextReveal });
    expect(result.current.step?.kind).toBe('chant');

    act(() => {
      jest.advanceTimersByTime(GAME_START_TURN_REVEAL_DELAY_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(2);
    expect(result.current.highlightSeatId).toBe('seat-0');
  });

  it('clears pending timers on unmount', () => {
    const onDone = jest.fn();
    const reveal = makeReveal();
    const { unmount } = renderHook(() =>
      useFirstTurnReveal({ reveal, seatIds: SEAT_IDS, onDone }),
    );

    unmount();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(onDone).not.toHaveBeenCalled();
  });

  it('completes immediately when the first turn seat is not at the table', () => {
    const onDone = jest.fn();
    const missingSeatReveal: FirstTurnReveal = {
      roomId: 'room-1',
      seatId: 'seat-9',
      lastBlowSeatId: 'seat-1',
      token: Date.now(),
    };
    const { result } = renderHook(() =>
      useFirstTurnReveal({ reveal: missingSeatReveal, seatIds: SEAT_IDS, onDone }),
    );

    expect(result.current.step).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
