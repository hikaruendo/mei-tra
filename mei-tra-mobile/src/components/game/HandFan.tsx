import type { DealAnimationCue } from '@meitra/game-client/deal-animation';
import { reorderHand, syncHandOrder } from '@meitra/game-client/hand-order';
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type PanResponderGestureState,
  type PanResponderInstance,
} from 'react-native';

import { DealtCard } from '@/components/game/DealtCard';
import { PlayingCard } from '@/components/game/PlayingCard';
import { draggableCardStyle } from '@/lib/draggable-card-style';
import {
  handDropPlacement,
  handFanPitch,
  type HandDropPlacement,
} from '@/lib/hand-drag';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';
import {
  classifyCardDrop,
  isPointInRect,
  type CardDropAction,
  type DropTargetRect,
} from '@meitra/game-client/drag-action';

/** How far the finger must travel sideways before the card is picked up. */
const DRAG_ACTIVATE_PX = 6;
/** Raises the held card clear of the finger. */
const DRAG_LIFT = 34;
const SELECTED_LIFT = 28;
const FAN_ROTATION_DEG = 15;
const FAN_SPREAD_LIFT = 18;

const dropActionLabelKeys: Record<CardDropAction, string> = {
  play: 'board.play',
  negri: 'board.setNegri',
};

const samePlacement = (
  a: HandDropPlacement | null,
  b: HandDropPlacement | null,
) => a?.card === b?.card && a?.side === b?.side;

/** How far the finger has moved, and where it is on screen. */
type DragPoint = Pick<PanResponderGestureState, 'dx' | 'dy' | 'moveX' | 'moveY'>;

interface HandFanProps {
  /** The authoritative hand. The arranged order is kept separately. */
  cards: string[];
  cardWidth: number;
  cardMargin: number;
  seatId: string;
  selectedCard: string | null;
  dealAnimationCue?: DealAnimationCue | null;
  reducedMotion: boolean | null;
  /** Omitted when cards cannot be picked to play, such as during the blow phase. */
  onSelectCard?: (card: string) => void;
  isCardDisabled?: (card: string) => boolean;
  /** Lets the player pick cards up, to reorder them or, in pro mode, to drop them. */
  canReorder: boolean;
  /** Fires once per committed move, for the sound. */
  onReorder?: () => void;
  onDropAction?: (card: string, action: CardDropAction) => void;
  /**
   * The drops that act right now. They are also offered as screen reader
   * actions, because a screen reader cannot perform the drag.
   */
  dropActions?: readonly CardDropAction[];
  /**
   * The player's own seat info. Letting a card go over it places the Negri,
   * so it is passed only while a Negri can be placed.
   */
  negriDropTarget?: RefObject<View | null>;
  /** What letting go right now would do, among the drops that act. */
  onDropPreview?: (action: CardDropAction | null) => void;
  /** Lets the parent stop its scroll view from panning while a card is held. */
  onDragActiveChange?: (active: boolean) => void;
}

export function HandFan({
  cards,
  cardWidth,
  cardMargin,
  seatId,
  selectedCard,
  dealAnimationCue = null,
  reducedMotion,
  onSelectCard,
  isCardDisabled,
  canReorder,
  onReorder,
  onDropAction,
  dropActions = [],
  negriDropTarget,
  onDropPreview,
  onDragActiveChange,
}: HandFanProps) {
  const [order, setOrder] = useState(cards);
  const orderRef = useRef(order);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [drop, setDrop] = useState<HandDropPlacement | null>(null);
  const [dropPreview, setDropPreview] = useState<CardDropAction | null>(null);
  // The release event can arrive before React has re-rendered the last move, so
  // the drop the reorder commits is read from here rather than from state.
  const dropRef = useRef<HandDropPlacement | null>(null);
  // Where the Negri target sat on screen when the drag started. The parent
  // stops its scroll view while a card is held, so it stays put until release.
  const negriRectRef = useRef<DropTargetRect | null>(null);
  const syncedHandRef = useRef(cards);

  useEffect(() => {
    const previousHand = syncedHandRef.current;
    syncedHandRef.current = cards;

    setOrder((previousOrder) => {
      const nextOrder = syncHandOrder(previousOrder, cards);
      orderRef.current = nextOrder;
      return nextOrder;
    });

    // A broken hand or an all-pass round deals every hand again, and the blow
    // phase allows reordering, so that can land mid-drag. Carrying the drag
    // over would move a card the player never picked up, and when the held card
    // is not dealt back its card unmounts, so no release arrives to end it.
    // Only the contents matter here: the hand arrives as a new array whenever
    // any player acts, and those must not interrupt a drag.
    const handChanged =
      cards.length !== previousHand.length ||
      cards.some((card) => !previousHand.includes(card));
    if (handChanged) {
      dropRef.current = null;
      setDraggingCard(null);
      setDrop(null);
      setDropPreview(null);
    }
  }, [cards]);

  const dragActive = draggingCard !== null;
  useEffect(() => {
    if (!dragActive) return;
    onDragActiveChange?.(true);
    // Also runs when the fan unmounts mid-drag, which sends no release.
    return () => onDragActiveChange?.(false);
  }, [dragActive, onDragActiveChange]);

  useEffect(() => {
    onDropPreview?.(dropPreview);
  }, [dropPreview, onDropPreview]);

  const pitch = handFanPitch(cardWidth, cardMargin);
  const total = order.length;

  const measureNegriTarget = () => {
    negriRectRef.current = null;
    negriDropTarget?.current?.measure(
      (_x, _y, width, height, pageX, pageY) => {
        negriRectRef.current = { left: pageX, top: pageY, width, height };
      },
    );
  };

  // What letting go at this point would do. The finger's screen position
  // (moveX, moveY) is compared with the target measured at the drag start.
  const dropActionAt = ({ dy, moveX, moveY }: DragPoint) =>
    classifyCardDrop({
      deltaY: dy,
      overNegriTarget:
        negriDropTarget !== undefined &&
        isPointInRect({ x: moveX, y: moveY }, negriRectRef.current),
    });

  const endDrag = (
    card: string,
    committed: boolean,
    action: CardDropAction | null,
  ) => {
    const placement = dropRef.current;
    dropRef.current = null;
    setDraggingCard(null);
    setDrop(null);
    setDropPreview(null);

    if (!committed) return;

    // The parent takes a drop action only in pro mode, and only when the drop
    // is legal, so the sideways half of the drag is still honoured below: a
    // reorder must not be swallowed because the finger strayed vertically.
    if (action) onDropAction?.(card, action);

    if (!placement) return;

    const nextOrder = reorderHand(
      orderRef.current,
      card,
      placement.card,
      placement.side,
    );
    if (!nextOrder) return;

    orderRef.current = nextOrder;
    setOrder(nextOrder);
    onReorder?.();
  };

  return (
    <View style={styles.fanContainer}>
      {order.map((card, index) => {
        const half = Math.max((total - 1) / 2, 1);
        const norm = (index - (total - 1) / 2) / half;
        const isSelected = selectedCard === card;

        return (
          <HandFanCard
            key={card}
            // A lone card is still picked up: in pro mode dragging is how it
            // is played, and a reorder of one card simply does nothing.
            canReorder={canReorder}
            card={card}
            cardMargin={total > 1 ? cardMargin : 0}
            cardWidth={cardWidth}
            dealAnimationCue={dealAnimationCue}
            disabled={isCardDisabled?.(card) ?? false}
            dropActionAt={dropActionAt}
            dropActions={dropActions}
            dropSide={drop?.card === card ? drop.side : null}
            index={index}
            isDragging={draggingCard === card}
            lift={
              Math.pow(Math.abs(norm), 2) * FAN_SPREAD_LIFT +
              (isSelected ? -SELECTED_LIFT : 0)
            }
            onAccessibilityDrop={(action) => onDropAction?.(card, action)}
            onDragEnd={(committed, action) => endDrag(card, committed, action)}
            onDragMove={(point) => {
              const action = dropActionAt(point);
              const preview =
                action !== null && dropActions.includes(action) ? action : null;
              setDropPreview(preview);
              // Over the Negri target the finger has left the fan, so no slot
              // is marked and letting go does not reorder.
              const next =
                preview === 'negri'
                  ? null
                  : handDropPlacement(orderRef.current, card, point.dx, pitch);
              if (samePlacement(next, dropRef.current)) return;
              dropRef.current = next;
              setDrop(next);
            }}
            onDragStart={() => {
              dropRef.current = null;
              setDraggingCard(card);
              setDrop(null);
              measureNegriTarget();
            }}
            onPress={onSelectCard ? () => onSelectCard(card) : undefined}
            reducedMotion={reducedMotion}
            rotation={norm * FAN_ROTATION_DEG}
            seatId={seatId}
            selected={isSelected}
            showsNegriLabel={draggingCard === card && dropPreview === 'negri'}
          />
        );
      })}
    </View>
  );
}

interface HandFanCardProps {
  canReorder: boolean;
  card: string;
  cardMargin: number;
  cardWidth: number;
  dealAnimationCue: DealAnimationCue | null;
  disabled: boolean;
  dropActionAt: (point: DragPoint) => CardDropAction | null;
  dropActions: readonly CardDropAction[];
  dropSide: HandDropPlacement['side'] | null;
  index: number;
  isDragging: boolean;
  lift: number;
  onAccessibilityDrop: (action: CardDropAction) => void;
  onDragEnd: (committed: boolean, action: CardDropAction | null) => void;
  onDragMove: (point: DragPoint) => void;
  onDragStart: () => void;
  onPress?: () => void;
  reducedMotion: boolean | null;
  rotation: number;
  seatId: string;
  selected: boolean;
  /** The held card is over the Negri target, so letting go sets it aside. */
  showsNegriLabel: boolean;
}

function HandFanCard({
  canReorder,
  card,
  cardMargin,
  cardWidth,
  dealAnimationCue,
  disabled,
  dropActionAt,
  dropActions,
  dropSide,
  index,
  isDragging,
  lift,
  onAccessibilityDrop,
  onDragEnd,
  onDragMove,
  onDragStart,
  onPress,
  reducedMotion,
  rotation,
  seatId,
  selected,
  showsNegriLabel,
}: HandFanCardProps) {
  const suppressPressRef = useRef(false);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // PanResponder is built once and keeps the callbacks it was given, so they
  // read the current props through this ref instead of the first render's.
  const live = useRef({
    canReorder,
    dropActionAt,
    dropActions,
    onDragStart,
    onDragMove,
    onDragEnd,
  });
  useEffect(() => {
    live.current = {
      canReorder,
      dropActionAt,
      dropActions,
      onDragStart,
      onDragMove,
      onDragEnd,
    };
  });

  // The parent also ends a drag on its own when the hand is dealt again, which
  // sends no release, so the offset is cleared from the flag rather than only
  // from the release handler.
  useEffect(() => {
    if (!isDragging) {
      pan.setValue({ x: 0, y: 0 });
    }
  }, [isDragging, pan]);

  const panResponder = useRef<PanResponderInstance | null>(null);
  if (panResponder.current === null) {
    const release = (committed: boolean, point: DragPoint) => {
      // A play or a Negri drop takes the card out of the fan. Resetting the
      // offset here reaches the native view before the render that removes the
      // card, so it would flash back into its slot for a frame. If the card
      // stays in the hand after all, the isDragging effect above resets it.
      const action = live.current.dropActionAt(point);
      const leavesHand =
        committed && action !== null && live.current.dropActions.includes(action);
      if (!leavesHand) {
        pan.setValue({ x: 0, y: 0 });
      }
      live.current.onDragEnd(committed, action);
    };

    panResponder.current = PanResponder.create({
      // A tap has to keep reaching the card underneath, so the drag only claims
      // the touch after a meaningful horizontal or vertical movement. Capturing is what lets it take
      // the touch off the Pressable that is already holding it.
      onStartShouldSetPanResponderCapture: () => {
        suppressPressRef.current = false;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        live.current.canReorder &&
        Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > DRAG_ACTIVATE_PX,
      onPanResponderGrant: () => {
        suppressPressRef.current = true;
        live.current.onDragStart();
      },
      onPanResponderMove: (_event, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy });
        live.current.onDragMove(gesture);
      },
      // Once the card is held, the surrounding scroll view must not take it away.
      // Refusing only covers JS responders; the parent also disables scrolling
      // through onDragActiveChange, or the platform scroll pans anyway.
      onPanResponderTerminationRequest: () => false,
      // The gesture state keeps the last move's values here, so the release
      // is judged at the same point the last move showed.
      onPanResponderRelease: (_event, gesture) => release(true, gesture),
      onPanResponderTerminate: (_event, gesture) => release(false, gesture),
    });
  }

  return (
    <Animated.View
      {...panResponder.current.panHandlers}
      style={[
        styles.fanCard,
        canReorder && draggableCardStyle,
        { marginHorizontal: cardMargin },
        isDragging && styles.fanCardDragging,
        {
          transform: [
            // Ahead of the rotation so the card tracks the finger rather than
            // its own tilted axes.
            { translateX: pan.x },
            { translateY: pan.y },
            // Straightening the held card reads as lifting it out of the fan.
            { rotate: isDragging ? '0deg' : `${rotation}deg` },
            { translateY: isDragging ? lift - DRAG_LIFT : lift },
            { scale: isDragging ? 1.05 : 1 },
          ],
        },
      ]}
      testID={`hand-card-${card}`}
    >
      {dropSide ? (
        <View
          pointerEvents="none"
          style={[
            styles.dropCaret,
            dropSide === 'before'
              ? styles.dropCaretBefore
              : styles.dropCaretAfter,
          ]}
          testID={`hand-drop-caret-${dropSide}`}
        />
      ) : null}
      <DealtCard
        cue={dealAnimationCue}
        index={index}
        reducedMotion={reducedMotion}
        seatId={seatId}
      >
        <PlayingCard
          accessibilityActions={
            dropActions.length > 0
              ? dropActions.map((name) => ({
                  name,
                  label: t(dropActionLabelKeys[name]),
                }))
              : undefined
          }
          card={card}
          disabled={disabled}
          onAccessibilityAction={(name) => {
            const action = dropActions.find((candidate) => candidate === name);
            if (action) onAccessibilityDrop(action);
          }}
          onPress={onPress ? () => {
            if (!suppressPressRef.current) onPress();
          } : undefined}
          selected={selected}
          width={cardWidth}
        />
      </DealtCard>
      {/* The finger and the lifted card cover much of the seat info, so the
          card itself says that letting go sets it aside as the Negri. */}
      {showsNegriLabel ? (
        <View
          pointerEvents="none"
          style={styles.negriLabel}
          testID="hand-negri-label"
        >
          <Text numberOfLines={1} style={styles.negriLabelText}>
            {t('board.setNegri')}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fanContainer: {
    minHeight: 104,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 4,
  },
  fanCard: {
    zIndex: 1,
    // Web rotates hand cards about their bottom edge
    // (PlayerHand/index.module.scss: transform-origin: bottom center).
    // Without this the fan pivots about each card's centre and splays wrongly.
    transformOrigin: 'bottom center',
  },
  fanCardDragging: {
    zIndex: 60,
  },
  dropCaret: {
    position: 'absolute',
    top: '8%',
    bottom: '8%',
    zIndex: 70,
    width: 4,
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  dropCaretBefore: {
    left: -6,
  },
  dropCaretAfter: {
    right: -6,
  },
  negriLabel: {
    position: 'absolute',
    top: 6,
    // Wider than a narrow hand card, so the label stays on one line.
    left: -30,
    right: -30,
    zIndex: 80,
    alignItems: 'center',
  },
  negriLabelText: {
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.gold,
    color: colors.onAccent,
    fontSize: 10,
    fontWeight: '800',
  },
});
