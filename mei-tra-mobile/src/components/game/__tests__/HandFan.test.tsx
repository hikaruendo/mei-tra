import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { HandFan } from '../HandFan';

const CARD_WIDTH = 60;
const CARD_MARGIN = -20;
/** cardWidth + 2 * cardMargin — one slot along the fan. */
const PITCH = 20;
/** Must clear HandFan's DRAG_ACTIVATE_PX before the card is picked up. */
const ACTIVATE_PX = 8;
const START_X = 200;
const START_Y = 500;

// react-test-renderer's published types omit `root`, so the parts used here are
// declared explicitly, as in BlowControls.test.tsx.
interface TestNode {
  type: unknown;
  props: Record<string, unknown>;
}

interface Renderer {
  root: {
    find: (predicate: (node: TestNode) => boolean) => TestNode;
    findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  };
  update: (element: React.ReactElement) => void;
}

/**
 * PanResponder derives its gesture from the touch history rather than from
 * arguments, so the drags below are driven through real event shapes.
 */
const touchEvent = (
  from: { x: number; y: number; at: number },
  to: { x: number; y: number; at: number },
  active = true,
) => ({
  nativeEvent: { touches: active ? [{ identifier: 0 }] : [] },
  touchHistory: {
    numberActiveTouches: active ? 1 : 0,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: to.at,
    touchBank: [
      {
        touchActive: active,
        startPageX: START_X,
        startPageY: START_Y,
        startTimeStamp: 0,
        currentPageX: to.x,
        currentPageY: to.y,
        currentTimeStamp: to.at,
        previousPageX: from.x,
        previousPageY: from.y,
        previousTimeStamp: from.at,
      },
    ],
  },
});

const handlersFor = (renderer: Renderer, card: string) =>
  renderer.root.find(
    (node) =>
      typeof node.type === 'string' &&
      node.props.testID === `hand-card-${card}`,
  ).props as {
    onStartShouldSetResponderCapture: (event: unknown) => boolean;
    onMoveShouldSetResponderCapture: (event: unknown) => boolean;
    onResponderGrant: (event: unknown) => void;
    onResponderMove: (event: unknown) => void;
    onResponderRelease: (event: unknown) => void;
  };

/** Runs the touch down / move / up sequence a real drag produces. */
const startDrag = (renderer: Renderer, card: string, dx: number, dy = 0) => {
  const handlers = handlersFor(renderer, card);
  const activateX = START_X + Math.sign(dx || 1) * ACTIVATE_PX;
  const endX = activateX + dx;
  const endY = START_Y + dy;

  const down = touchEvent(
    { x: START_X, y: START_Y, at: 0 },
    { x: START_X, y: START_Y, at: 0 },
  );
  const move = touchEvent(
    { x: START_X, y: START_Y, at: 0 },
    { x: activateX, y: START_Y + Math.sign(dy) * ACTIVATE_PX, at: 10 },
  );

  let claimed = false;
  act(() => {
    handlers.onStartShouldSetResponderCapture(down);
    claimed = handlers.onMoveShouldSetResponderCapture(move);
    if (claimed) {
      handlers.onResponderGrant(move);
      handlers.onResponderMove(
        touchEvent(
          { x: activateX, y: START_Y, at: 10 },
          { x: endX, y: endY, at: 20 },
        ),
      );
    }
  });

  return {
    claimed,
    release: () =>
      act(() => {
        handlers.onResponderRelease(
          touchEvent(
            { x: endX, y: endY, at: 20 },
            { x: endX, y: endY, at: 30 },
            false,
          ),
        );
      }),
  };
};

const drag = (renderer: Renderer, card: string, dx: number) => {
  const gesture = startDrag(renderer, card, dx);
  gesture.release();
  return gesture;
};

const render = (props: Partial<React.ComponentProps<typeof HandFan>> = {}) => {
  let renderer!: Renderer;
  act(() => {
    renderer = TestRenderer.create(
      <HandFan
        canReorder
        cardMargin={CARD_MARGIN}
        cardWidth={CARD_WIDTH}
        cards={['A', 'B', 'C', 'D']}
        reducedMotion
        seatId="seat-1"
        selectedCard={null}
        {...props}
      />,
    ) as unknown as Renderer;
  });
  return renderer;
};

const cardOrder = (renderer: Renderer): string[] =>
  renderer.root
    .findAll(
      (node) =>
        // Host views only; the composite element carries the same testID.
        typeof node.type === 'string' &&
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('hand-card-'),
    )
    .map((node) => (node.props.testID as string).replace('hand-card-', ''));

describe('HandFan', () => {
  it('moves a dragged card to the slot the finger reached', () => {
    const renderer = render();
    expect(cardOrder(renderer)).toEqual(['A', 'B', 'C', 'D']);

    drag(renderer, 'A', 2 * PITCH);

    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('moves a card backwards through the fan', () => {
    const renderer = render();

    drag(renderer, 'D', -2 * PITCH);

    expect(cardOrder(renderer)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('stops at the end of the hand however far the finger goes', () => {
    const renderer = render();

    drag(renderer, 'A', 99 * PITCH);

    expect(cardOrder(renderer)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('reports each committed move once, and stays quiet when nothing moves', () => {
    const onReorder = jest.fn();
    const renderer = render({ onReorder });

    drag(renderer, 'A', 2 * PITCH);
    expect(onReorder).toHaveBeenCalledTimes(1);

    // Too short to leave its own slot.
    drag(renderer, 'B', 4);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('marks the drop point while the card is held, and clears it on release', () => {
    const renderer = render();

    const gesture = startDrag(renderer, 'A', 2 * PITCH);
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          node.props.testID === 'hand-drop-caret-after',
      ).length,
    ).toBeGreaterThan(0);

    gesture.release();
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          node.props.testID === 'hand-drop-caret-after',
      ),
    ).toHaveLength(0);
  });

  it('keeps the arranged order when the server sends the hand back', () => {
    const renderer = render();
    drag(renderer, 'A', 2 * PITCH);
    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);

    act(() => {
      renderer.update(
        <HandFan
          canReorder
          cardMargin={CARD_MARGIN}
          cardWidth={CARD_WIDTH}
          cards={['A', 'B', 'C', 'D', 'E']}
          reducedMotion
          seatId="seat-1"
          selectedCard={null}
        />,
      );
    });

    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D', 'E']);
  });

  it('keeps the drag alive while other players act', () => {
    const renderer = render();
    const gesture = startDrag(renderer, 'A', 2 * PITCH);

    // Every player action rebuilds the snapshot, so the same hand arrives as a
    // new array. That must not interrupt a drag in progress.
    act(() => {
      renderer.update(
        <HandFan
          canReorder
          cardMargin={CARD_MARGIN}
          cardWidth={CARD_WIDTH}
          cards={['A', 'B', 'C', 'D']}
          reducedMotion
          seatId="seat-1"
          selectedCard={null}
        />,
      );
    });

    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          node.props.testID === 'hand-drop-caret-after',
      ).length,
    ).toBeGreaterThan(0);

    gesture.release();
    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('drops the held card when a re-deal takes it out of the hand', () => {
    const renderer = render();
    // 'A' is held, and the caret sits on 'C'.
    startDrag(renderer, 'A', 2 * PITCH);

    // A broken hand or an all-pass round deals every hand again. 'A' is gone,
    // so no release will ever reach the fan; 'C' comes back.
    act(() => {
      renderer.update(
        <HandFan
          canReorder
          cardMargin={CARD_MARGIN}
          cardWidth={CARD_WIDTH}
          cards={['X', 'C', 'Y', 'Z']}
          reducedMotion
          seatId="seat-1"
          selectedCard={null}
        />,
      );
    });

    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('hand-drop-caret-'),
      ),
    ).toHaveLength(0);
  });

  it('puts a re-dealt held card back down', () => {
    const renderer = render();
    startDrag(renderer, 'A', 2 * PITCH);

    act(() => {
      renderer.update(
        <HandFan
          canReorder
          cardMargin={CARD_MARGIN}
          cardWidth={CARD_WIDTH}
          cards={['X', 'A', 'Y', 'Z']}
          reducedMotion
          seatId="seat-1"
          selectedCard={null}
        />,
      );
    });

    const card = renderer.root.find(
      (node) =>
        typeof node.type === 'string' &&
        node.props.testID === 'hand-card-A',
    );
    const transform = (
      StyleSheet.flatten(card.props.style as StyleProp<ViewStyle>) ?? {}
    ).transform as { scale?: number }[] | undefined;

    // A held card is scaled up; back in the fan it must sit flat again.
    expect(transform?.find((entry) => 'scale' in entry)?.scale).toBe(1);
  });

  it('does not pick up cards for a spectator', () => {
    const renderer = render({ canReorder: false });

    expect(drag(renderer, 'A', 2 * PITCH).claimed).toBe(false);
    expect(cardOrder(renderer)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('leaves a vertical swipe to the surrounding scroll view', () => {
    const renderer = render();
    const handlers = handlersFor(renderer, 'A');

    const claimed = handlers.onMoveShouldSetResponderCapture(
      touchEvent(
        { x: START_X, y: START_Y, at: 0 },
        { x: START_X + 3, y: START_Y + 40, at: 10 },
      ),
    );

    expect(claimed).toBe(false);
  });

  it('lets a tap through to the card underneath', () => {
    const renderer = render();
    const handlers = handlersFor(renderer, 'A');

    expect(
      handlers.onStartShouldSetResponderCapture(
        touchEvent(
          { x: START_X, y: START_Y, at: 0 },
          { x: START_X, y: START_Y, at: 0 },
        ),
      ),
    ).toBe(false);
  });
});
