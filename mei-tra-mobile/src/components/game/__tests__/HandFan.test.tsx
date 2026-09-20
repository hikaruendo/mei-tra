import React from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { HandFan } from '../HandFan';

const CARD_WIDTH = 60;
const CARD_MARGIN = -20;
/** cardWidth + 2 * cardMargin — one slot along the fan. */
const PITCH = 20;
/** Must clear HandFan's DRAG_ACTIVATE_PX before the card is picked up. */
const ACTIVATE_PX = 8;
/** Must clear classifyCardDrop's threshold to count as a play or negri drop. */
const DROP_PX = 120;
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
  unmount: () => void;
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

/**
 * Stands in for the seat info view the parent passes as the Negri target.
 * The default rect sits left of where the drags start and spans their height.
 */
const negriTarget = (rect = { left: 0, top: 400, width: 80, height: 200 }) =>
  ({
    current: {
      measure: (
        callback: (
          x: number,
          y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number,
        ) => void,
      ) => callback(0, 0, rect.width, rect.height, rect.left, rect.top),
    },
  }) as unknown as React.RefObject<View | null>;

/** A leftward drag that ends with the finger at x = 40, inside the default target. */
const OVER_NEGRI_TARGET_DX = 40 - (START_X - ACTIVATE_PX);

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

/** A held card is scaled up; back in the fan it sits flat again. */
const cardScale = (renderer: Renderer, card: string): number | undefined => {
  const node = renderer.root.find(
    (candidate) =>
      typeof candidate.type === 'string' &&
      candidate.props.testID === `hand-card-${card}`,
  );
  const transform = (
    StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {}
  ).transform as { scale?: number }[] | undefined;

  return transform?.find((entry) => 'scale' in entry)?.scale;
};

const caretCount = (renderer: Renderer): number =>
  renderer.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('hand-drop-caret-'),
  ).length;

const negriLabelCount = (renderer: Renderer): number =>
  renderer.root.findAll(
    (node) =>
      typeof node.type === 'string' && node.props.testID === 'hand-negri-label',
  ).length;

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
  it('suppresses a press following a drag, then accepts a new touch', () => {
    const onSelectCard = jest.fn();
    const renderer = render({ onSelectCard });
    const press = () => (renderer.root.find(
      (node) => node.props.width === CARD_WIDTH && node.props.card === 'A' && typeof node.props.onPress === 'function',
    ).props.onPress as () => void)();
    drag(renderer, 'A', 2 * PITCH);
    act(() => press());
    expect(onSelectCard).not.toHaveBeenCalled();
    const point = { x: START_X, y: START_Y, at: 0 };
    act(() => { handlersFor(renderer, 'A').onStartShouldSetResponderCapture(touchEvent(point, point)); });
    act(() => press());
    expect(onSelectCard).toHaveBeenCalledWith('A');
    act(() => renderer.unmount());
  });

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

  it('keeps the arranged order when the server sends the same hand back', () => {
    const renderer = render();
    drag(renderer, 'A', 2 * PITCH);
    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);

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

    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('takes the dealt order when a card joins an arranged hand', () => {
    const renderer = render();
    drag(renderer, 'A', 2 * PITCH);
    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);

    // The server sorts by suit whenever it adds a card, so the arrangement
    // gives way instead of stranding the new card at the end.
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

    expect(cardOrder(renderer)).toEqual(['A', 'B', 'C', 'D', 'E']);
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

    expect(cardScale(renderer, 'A')).toBe(1);
  });

  it('tells the parent a card is held until it is released', () => {
    const onDragActiveChange = jest.fn();
    const renderer = render({ onDragActiveChange });

    const gesture = startDrag(renderer, 'A', 0, -DROP_PX);
    expect(onDragActiveChange.mock.calls).toEqual([[true]]);

    gesture.release();
    expect(onDragActiveChange.mock.calls).toEqual([[true], [false]]);
  });

  it('tells the parent the hold is over when no release can arrive', () => {
    const onDragActiveChange = jest.fn();
    const renderer = render({ onDragActiveChange });

    startDrag(renderer, 'A', 2 * PITCH);
    act(() => {
      renderer.update(
        <HandFan
          canReorder
          cardMargin={CARD_MARGIN}
          cardWidth={CARD_WIDTH}
          cards={['X', 'C', 'Y', 'Z']}
          onDragActiveChange={onDragActiveChange}
          reducedMotion
          seatId="seat-1"
          selectedCard={null}
        />,
      );
    });
    expect(onDragActiveChange).toHaveBeenLastCalledWith(false);

    startDrag(renderer, 'C', 2 * PITCH);
    expect(onDragActiveChange).toHaveBeenLastCalledWith(true);
    act(() => renderer.unmount());
    expect(onDragActiveChange).toHaveBeenLastCalledWith(false);
  });

  it('does not pick up cards for a spectator', () => {
    const renderer = render({ canReorder: false });

    expect(drag(renderer, 'A', 2 * PITCH).claimed).toBe(false);
    expect(cardOrder(renderer)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('claims a vertical drag, which is how a card is played', () => {
    const renderer = render();
    const handlers = handlersFor(renderer, 'A');

    const claimed = handlers.onMoveShouldSetResponderCapture(
      touchEvent(
        { x: START_X, y: START_Y, at: 0 },
        { x: START_X + 3, y: START_Y + 40, at: 10 },
      ),
    );

    expect(claimed).toBe(true);
  });

  it('reports an upward drop as a play and a drop on the Negri target as a Negri', () => {
    const onDropAction = jest.fn();
    const renderer = render({ onDropAction, negriDropTarget: negriTarget() });

    startDrag(renderer, 'A', 0, -DROP_PX).release();
    expect(onDropAction).toHaveBeenNthCalledWith(1, 'A', 'play');

    startDrag(renderer, 'B', OVER_NEGRI_TARGET_DX).release();
    expect(onDropAction).toHaveBeenNthCalledWith(2, 'B', 'negri');
  });

  it('places no Negri for a card only dragged down', () => {
    // The hand sits near the bottom of the screen, and a reorder that drifts
    // down must not set a Negri aside for good.
    const onDropAction = jest.fn();
    const renderer = render({ onDropAction, negriDropTarget: negriTarget() });

    startDrag(renderer, 'A', 0, DROP_PX).release();

    expect(onDropAction).not.toHaveBeenCalled();
  });

  it('places no Negri over the seat info when no target is passed', () => {
    // The parent passes the target only while a Negri can be placed, and a
    // drag that far left then reorders as before.
    const onDropAction = jest.fn();
    const renderer = render({ onDropAction });

    startDrag(renderer, 'D', OVER_NEGRI_TARGET_DX).release();

    expect(onDropAction).not.toHaveBeenCalled();
    expect(cardOrder(renderer)).toEqual(['D', 'A', 'B', 'C']);
  });

  it('marks no slot over the Negri target and keeps the order on release', () => {
    const onDropPreview = jest.fn();
    const onReorder = jest.fn();
    const renderer = render({
      dropActions: ['negri'],
      negriDropTarget: negriTarget(),
      onDropPreview,
      onReorder,
    });

    const gesture = startDrag(renderer, 'D', OVER_NEGRI_TARGET_DX);
    expect(caretCount(renderer)).toBe(0);
    expect(onDropPreview).toHaveBeenLastCalledWith('negri');
    expect(negriLabelCount(renderer)).toBe(1);

    gesture.release();

    expect(onDropPreview).toHaveBeenLastCalledWith(null);
    expect(negriLabelCount(renderer)).toBe(0);
    expect(cardOrder(renderer)).toEqual(['A', 'B', 'C', 'D']);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('previews only a drop that acts', () => {
    const onDropPreview = jest.fn();
    const renderer = render({
      dropActions: ['negri'],
      negriDropTarget: negriTarget(),
      onDropPreview,
    });

    // Not this player's turn: an upward drag would play nothing.
    const gesture = startDrag(renderer, 'A', 0, -DROP_PX);
    expect(onDropPreview).not.toHaveBeenCalledWith('play');
    // Holding a card away from the target says nothing about the Negri.
    expect(onDropPreview).not.toHaveBeenCalledWith('negri');
    expect(negriLabelCount(renderer)).toBe(0);
    gesture.release();
  });

  it('picks up a lone card so a pro drop can still play it', () => {
    const onDropAction = jest.fn();
    const renderer = render({ cards: ['A'], onDropAction });

    const gesture = startDrag(renderer, 'A', 0, -DROP_PX);
    expect(gesture.claimed).toBe(true);
    gesture.release();

    expect(onDropAction).toHaveBeenCalledWith('A', 'play');
  });

  it('offers the drops that act as screen reader actions', () => {
    const onDropAction = jest.fn();
    const renderer = render({ dropActions: ['play', 'negri'], onDropAction });
    const cardA = renderer.root.find(
      (node) =>
        typeof node.type === 'string' &&
        node.props.accessibilityLabel === 'A',
    ).props as {
      accessibilityActions: { name: string; label: string }[];
      accessibilityState: { disabled: boolean };
      onAccessibilityAction: (event: unknown) => void;
    };

    expect(cardA.accessibilityActions.map((action) => action.name)).toEqual([
      'play',
      'negri',
    ]);
    // A card with actions must not be announced as dimmed.
    expect(cardA.accessibilityState.disabled).toBe(false);

    act(() => {
      cardA.onAccessibilityAction({ nativeEvent: { actionName: 'negri' } });
    });
    expect(onDropAction).toHaveBeenCalledWith('A', 'negri');
  });

  it('offers no screen reader actions when no drop acts', () => {
    const renderer = render();
    const cardA = renderer.root.find(
      (node) =>
        typeof node.type === 'string' &&
        node.props.accessibilityLabel === 'A',
    );

    expect(cardA.props.accessibilityActions).toBeUndefined();
  });

  it('puts the card back down once the drop action is reported', () => {
    const onDropAction = jest.fn();
    const renderer = render({ onDropAction });

    const gesture = startDrag(renderer, 'A', 0, -DROP_PX);
    expect(cardScale(renderer, 'A')).toBe(1.05);

    gesture.release();

    expect(onDropAction).toHaveBeenCalledWith('A', 'play');
    expect(cardScale(renderer, 'A')).toBe(1);
  });

  describe('the card offset when a drop is reported', () => {
    // On a device the offset reset reaches the native view before the render
    // that removes a played card, so the reset must not come first for a drop
    // that takes the card out of the hand.
    const offsetAtDrop = (dropActions: ('play' | 'negri')[]) => {
      const setValue = jest.spyOn(Animated.ValueXY.prototype, 'setValue');
      const offsets: unknown[] = [];
      try {
        const renderer = render({
          dropActions,
          onDropAction: () => offsets.push(setValue.mock.calls.at(-1)?.[0]),
        });
        startDrag(renderer, 'A', 0, -DROP_PX).release();
        // Either way the card sits flat again if it is still in the hand.
        expect(cardScale(renderer, 'A')).toBe(1);
      } finally {
        setValue.mockRestore();
      }
      expect(offsets).toHaveLength(1);
      return offsets[0];
    };

    it('keeps the card where it was let go when the drop takes it', () => {
      expect(offsetAtDrop(['play'])).not.toEqual({ x: 0, y: 0 });
    });

    it('puts the card back in its slot first when the drop does not act', () => {
      expect(offsetAtDrop(['negri'])).toEqual({ x: 0, y: 0 });
    });
  });

  it('puts the card back down, and still reorders, when nothing acts on the drop', () => {
    // Outside pro mode, and out of turn within it, the parent ignores the
    // action. The card must not stay lifted, and a drag that strayed past the
    // vertical threshold must still land the move the player made sideways.
    const onDropAction = jest.fn();
    const onReorder = jest.fn();
    const renderer = render({ onDropAction, onReorder });

    const gesture = startDrag(renderer, 'A', 2 * PITCH, -DROP_PX);
    expect(caretCount(renderer)).toBeGreaterThan(0);

    gesture.release();

    expect(onDropAction).toHaveBeenCalledWith('A', 'play');
    expect(cardScale(renderer, 'A')).toBe(1);
    expect(caretCount(renderer)).toBe(0);
    expect(cardOrder(renderer)).toEqual(['B', 'C', 'A', 'D']);
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it('puts the card back down when no drop handler is attached at all', () => {
    const renderer = render();

    startDrag(renderer, 'A', 0, -DROP_PX).release();

    expect(cardScale(renderer, 'A')).toBe(1);
    expect(caretCount(renderer)).toBe(0);
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


it('captures the original web pointer target without requiring a selection first', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const onSelectCard = jest.fn();
  const setPointerCapture = jest.fn();
  let renderer!: Renderer;
  try {
    act(() => {
      renderer = TestRenderer.create(
        <HandFan cards={['7♠', '9♠']} cardWidth={CARD_WIDTH} cardMargin={CARD_MARGIN}
          seatId="self" selectedCard={null} reducedMotion canReorder onSelectCard={onSelectCard} />,
      ) as unknown as Renderer;
    });
    const card = renderer.root.find((node) => typeof node.type === 'string' && node.props.testID === 'hand-card-7♠');
    const pointerDown = card.props.onPointerDown as (event: unknown) => void;
    pointerDown({ target: { setPointerCapture }, nativeEvent: { pointerId: 12 } });
    expect(setPointerCapture).toHaveBeenCalledWith(12);
    expect(onSelectCard).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  } finally {
    jest.restoreAllMocks();
  }
});
