'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildFirstTurnRevealScript,
  type FirstTurnRevealScript,
  type FirstTurnRevealStep,
} from '@meitra/game-client/first-turn-reveal';
import type { FirstTurnReveal } from '@/types/game.types';

interface UseFirstTurnRevealParams {
  reveal: FirstTurnReveal | null | undefined;
  seatIds: readonly string[];
  onDone: () => void;
}

interface UseFirstTurnRevealResult {
  step: FirstTurnRevealStep | null;
  /** Seat to light up once the janken has resolved. */
  highlightSeatId: string | null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Steps through the game-start janken reveal. The script is rebuilt only when a
 * new reveal token arrives, so re-renders never restart the animation.
 */
export function useFirstTurnReveal({
  reveal,
  seatIds,
  onDone,
}: UseFirstTurnRevealParams): UseFirstTurnRevealResult {
  const [state, setState] = useState<{
    script: FirstTurnRevealScript;
    stepIndex: number;
  } | null>(null);

  const seatIdsRef = useRef(seatIds);
  seatIdsRef.current = seatIds;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!reveal) {
      setState(null);
      return;
    }

    const script = buildFirstTurnRevealScript({
      seatIds: seatIdsRef.current,
      firstTurnSeatId: reveal.seatId,
      roomId: reveal.roomId,
      reducedMotion: prefersReducedMotion(),
    });

    if (!script) {
      setState(null);
      onDoneRef.current();
      return;
    }

    setState({ script, stepIndex: 0 });

    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    script.steps.forEach((step, index) => {
      elapsed += step.durationMs;
      const isLast = index === script.steps.length - 1;
      timers.push(
        setTimeout(() => {
          if (isLast) {
            onDoneRef.current();
            return;
          }
          setState((current) =>
            current ? { ...current, stepIndex: index + 1 } : current,
          );
        }, elapsed),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [reveal]);

  if (!state) {
    return { step: null, highlightSeatId: null };
  }

  const step = state.script.steps[state.stepIndex] ?? null;

  return {
    step,
    highlightSeatId:
      step?.kind === 'result' ? state.script.firstTurnSeatId : null,
  };
}
