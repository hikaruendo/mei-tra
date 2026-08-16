import { act, renderHook } from '@testing-library/react';
import { GAME_START_TURN_REVEAL_DELAY_MS } from '@contracts/game';
import { useFirstTurnReveal } from '@/components/game/StartPlayerJanken/useFirstTurnReveal';
import type { FirstTurnReveal } from '@/types/game.types';

const SEAT_IDS = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];

const reveal: FirstTurnReveal = {
  roomId: 'room-1',
  seatId: 'seat-2',
  token: 1,
};

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
    // Only the seat that blows first throws the losing hand.
    expect(result.current.step?.hands?.['seat-2']).not.toBe(
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
    renderHook(() => useFirstTurnReveal({ reveal, seatIds: SEAT_IDS, onDone }));

    act(() => {
      jest.advanceTimersByTime(GAME_START_TURN_REVEAL_DELAY_MS);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips straight to the result when motion is reduced', () => {
    mockReducedMotion(true);
    const onDone = jest.fn();
    const { result } = renderHook(() =>
      useFirstTurnReveal({ reveal, seatIds: SEAT_IDS, onDone }),
    );

    expect(result.current.step?.kind).toBe('result');
    expect(result.current.highlightSeatId).toBe('seat-2');

    act(() => {
      jest.advanceTimersByTime(1_400);
    });
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
      { initialProps: { current: reveal } },
    );

    act(() => {
      jest.advanceTimersByTime(GAME_START_TURN_REVEAL_DELAY_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    rerender({ current: { roomId: 'room-1', seatId: 'seat-0', token: 2 } });
    expect(result.current.step?.kind).toBe('chant');

    act(() => {
      jest.advanceTimersByTime(GAME_START_TURN_REVEAL_DELAY_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(2);
    expect(result.current.highlightSeatId).toBe('seat-0');
  });

  it('clears pending timers on unmount', () => {
    const onDone = jest.fn();
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
    const { result } = renderHook(() =>
      useFirstTurnReveal({
        reveal: { roomId: 'room-1', seatId: 'seat-9', token: 3 },
        seatIds: SEAT_IDS,
        onDone,
      }),
    );

    expect(result.current.step).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
