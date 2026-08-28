import type { DealAnimationCue } from '@meitra/game-client/deal-animation';
import React, { useState } from 'react';
import { Animated, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { DealtCard } from '@/components/game/DealtCard';

describe('DealtCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the shared stagger and does not restart for an ordinary rerender', async () => {
    const cue: DealAnimationCue = {
      token: 1,
      startedAt: 1_000,
      seatIds: ['seat-1'],
    };
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const start = jest.fn();
    const stop = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop,
      reset: jest.fn(),
    } as never);
    let rerender: () => void = () => undefined;
    function TestCard() {
      const [label, setLabel] = useState('card');
      rerender = () => setLabel('updated card');
      return (
        <DealtCard cue={cue} index={2} reducedMotion={false} seatId="seat-1">
          <Text>{label}</Text>
        </DealtCard>
      );
    }

    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      renderer = TestRenderer.create(<TestCard />);
    });

    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0]?.[1]).toMatchObject({
      delay: 90,
      duration: 180,
      toValue: 1,
      useNativeDriver: true,
    });
    expect(start).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender();
    });
    expect(timing).toHaveBeenCalledTimes(1);

    await act(async () => renderer!.unmount());
  });

  it('shows cards immediately when reduced motion is enabled', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await act(async () => {
      TestRenderer.create(
        <DealtCard
          cue={{ token: 1, startedAt: Date.now(), seatIds: ['seat-1'] }}
          index={0}
          reducedMotion
          seatId="seat-1"
        >
          <Text>card</Text>
        </DealtCard>,
      );
    });

    expect(timing).not.toHaveBeenCalled();
  });
});
