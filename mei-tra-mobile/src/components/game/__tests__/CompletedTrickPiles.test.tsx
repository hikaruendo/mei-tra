import type { CompletedFieldContract } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';
import React from 'react';
import { Animated } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { CompletedTrickPiles } from '@/components/game/CompletedTrickPiles';

interface TestNode {
  type: unknown;
  props: Record<string, unknown>;
}

interface Renderer {
  root: {
    findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  };
  update: (element: React.ReactElement) => void;
}

const trick = (cards: string[], winner: string): CompletedFieldContract => ({
  cards,
  winnerSeatId: asSeatId(winner),
  dealerSeatId: asSeatId('seat-2'),
  winnerTeam: 0,
});

const first = trick(['A♠', '10♥', 'K♣', '3♦'], 'seat-1');
const second = trick(['2♠', '4♥', '6♦', '8♣'], 'seat-2');

const render = (
  fields: CompletedFieldContract[],
  reducedMotion = true,
): Renderer => {
  let renderer!: Renderer;
  act(() => {
    renderer = TestRenderer.create(
      <CompletedTrickPiles fields={fields} reducedMotion={reducedMotion} />,
    ) as unknown as Renderer;
  });
  return renderer;
};

// Pressable passes the testID through to its host View, so an unfiltered
// findAll returns each pile twice. Keep the composite: it is the one that
// carries onPress.
const piles = (renderer: Renderer) =>
  renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('trick-pile-'),
  );

const press = (pile: TestNode) =>
  act(() => {
    (pile.props.onPress as () => void)();
  });

const expanded = (pile: TestNode) =>
  (pile.props.accessibilityState as { expanded: boolean }).expanded;

describe('CompletedTrickPiles', () => {
  it('renders nothing when no trick has been won', () => {
    expect(piles(render([]))).toHaveLength(0);
  });

  it('lays every won trick face down', () => {
    const renderer = render([first, second]);

    const found = piles(renderer);
    expect(found).toHaveLength(2);
    found.forEach((pile) => expect(expanded(pile)).toBe(false));
  });

  it('turns one whole set over, and only one at a time', () => {
    const renderer = render([first, second]);

    press(piles(renderer)[0]);
    expect(expanded(piles(renderer)[0])).toBe(true);
    expect(expanded(piles(renderer)[1])).toBe(false);

    press(piles(renderer)[1]);
    expect(expanded(piles(renderer)[0])).toBe(false);
    expect(expanded(piles(renderer)[1])).toBe(true);
  });

  it('turns the open pile back over when it is picked again', () => {
    const renderer = render([first]);

    press(piles(renderer)[0]);
    expect(expanded(piles(renderer)[0])).toBe(true);

    press(piles(renderer)[0]);
    expect(expanded(piles(renderer)[0])).toBe(false);
  });

  it('drops the open pile when the round deals a new set of tricks', () => {
    const renderer = render([first]);
    press(piles(renderer)[0]);
    expect(expanded(piles(renderer)[0])).toBe(true);

    // A new round arrives as an empty list, then fills again.
    act(() => {
      renderer.update(<CompletedTrickPiles fields={[]} reducedMotion />);
    });
    act(() => {
      renderer.update(<CompletedTrickPiles fields={[second]} reducedMotion />);
    });

    expect(expanded(piles(renderer)[0])).toBe(false);
  });

  it('turns the four cards as one movement, staggered', () => {
    const start = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop: jest.fn(),
      reset: jest.fn(),
    } as never);

    try {
      const renderer = render([first], false);
      timing.mockClear();
      start.mockClear();

      press(piles(renderer)[0]);

      expect(timing).toHaveBeenCalledTimes(4);
      expect(
        timing.mock.calls.map((call) => (call[1] as { delay: number }).delay),
      ).toEqual([0, 55, 110, 165]);
      timing.mock.calls.forEach((call) => {
        expect(call[1]).toMatchObject({ toValue: 1, useNativeDriver: false });
      });
      expect(start).toHaveBeenCalledTimes(4);
    } finally {
      timing.mockRestore();
    }
  });

  it('snaps without animating when reduce motion is on', () => {
    const timing = jest.spyOn(Animated, 'timing');

    try {
      const renderer = render([first], true);
      timing.mockClear();

      press(piles(renderer)[0]);

      expect(timing).not.toHaveBeenCalled();
      expect(expanded(piles(renderer)[0])).toBe(true);
    } finally {
      timing.mockRestore();
    }
  });
});
