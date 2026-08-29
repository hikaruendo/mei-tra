import type { DealAnimationCue } from '@meitra/game-client/deal-animation';
import { reorderHand, syncHandOrder } from '@meitra/game-client/hand-order';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type PanResponderInstance,
} from 'react-native';

import { DealtCard } from '@/components/game/DealtCard';
import { PlayingCard } from '@/components/game/PlayingCard';
import {
  handDropPlacement,
  handFanPitch,
  type HandDropPlacement,
} from '@/lib/hand-drag';
import { colors } from '@/theme/colors';

/** How far the finger must travel sideways before the card is picked up. */
const DRAG_ACTIVATE_PX = 6;
/** Raises the held card clear of the finger. */
const DRAG_LIFT = 34;
const SELECTED_LIFT = 28;
const FAN_ROTATION_DEG = 15;
const FAN_SPREAD_LIFT = 18;

const samePlacement = (
  a: HandDropPlacement | null,
  b: HandDropPlacement | null,
) => a?.card === b?.card && a?.side === b?.side;

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
  canReorder: boolean;
  /** Fires once per committed move, for the sound. */
  onReorder?: () => void;
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
}: HandFanProps) {
  const [order, setOrder] = useState(cards);
  const orderRef = useRef(order);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [drop, setDrop] = useState<HandDropPlacement | null>(null);
  // The release event can arrive before React has re-rendered the last move, so
  // the drop the reorder commits is read from here rather than from state.
  const dropRef = useRef<HandDropPlacement | null>(null);
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
    }
  }, [cards]);

  const pitch = handFanPitch(cardWidth, cardMargin);
  const total = order.length;

  const endDrag = (card: string, committed: boolean) => {
    const placement = dropRef.current;
    dropRef.current = null;
    setDraggingCard(null);
    setDrop(null);

    if (!committed || !placement) return;

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
            canReorder={canReorder && total > 1}
            card={card}
            cardMargin={total > 1 ? cardMargin : 0}
            cardWidth={cardWidth}
            dealAnimationCue={dealAnimationCue}
            disabled={isCardDisabled?.(card) ?? false}
            dropSide={drop?.card === card ? drop.side : null}
            index={index}
            isDragging={draggingCard === card}
            lift={
              Math.pow(Math.abs(norm), 2) * FAN_SPREAD_LIFT +
              (isSelected ? -SELECTED_LIFT : 0)
            }
            onDragEnd={(committed) => endDrag(card, committed)}
            onDragMove={(dx) => {
              const next = handDropPlacement(
                orderRef.current,
                card,
                dx,
                pitch,
              );
              if (samePlacement(next, dropRef.current)) return;
              dropRef.current = next;
              setDrop(next);
            }}
            onDragStart={() => {
              dropRef.current = null;
              setDraggingCard(card);
              setDrop(null);
            }}
            onPress={onSelectCard ? () => onSelectCard(card) : undefined}
            reducedMotion={reducedMotion}
            rotation={norm * FAN_ROTATION_DEG}
            seatId={seatId}
            selected={isSelected}
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
  dropSide: HandDropPlacement['side'] | null;
  index: number;
  isDragging: boolean;
  lift: number;
  onDragEnd: (committed: boolean) => void;
  onDragMove: (dx: number) => void;
  onDragStart: () => void;
  onPress?: () => void;
  reducedMotion: boolean | null;
  rotation: number;
  seatId: string;
  selected: boolean;
}

function HandFanCard({
  canReorder,
  card,
  cardMargin,
  cardWidth,
  dealAnimationCue,
  disabled,
  dropSide,
  index,
  isDragging,
  lift,
  onDragEnd,
  onDragMove,
  onDragStart,
  onPress,
  reducedMotion,
  rotation,
  seatId,
  selected,
}: HandFanCardProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // PanResponder is built once and keeps the callbacks it was given, so they
  // read the current props through this ref instead of the first render's.
  const live = useRef({ canReorder, onDragStart, onDragMove, onDragEnd });
  useEffect(() => {
    live.current = { canReorder, onDragStart, onDragMove, onDragEnd };
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
    const release = (committed: boolean) => {
      pan.setValue({ x: 0, y: 0 });
      live.current.onDragEnd(committed);
    };

    panResponder.current = PanResponder.create({
      // A tap has to keep reaching the card underneath, so the drag only claims
      // the touch once the finger moves sideways. Capturing is what lets it take
      // the touch off the Pressable that is already holding it.
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        live.current.canReorder &&
        Math.abs(gesture.dx) > DRAG_ACTIVATE_PX &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => live.current.onDragStart(),
      onPanResponderMove: (_event, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy });
        live.current.onDragMove(gesture.dx);
      },
      // Once the card is held, the surrounding scroll view must not take it away.
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => release(true),
      onPanResponderTerminate: () => release(false),
    });
  }

  return (
    <Animated.View
      {...panResponder.current.panHandlers}
      style={[
        styles.fanCard,
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
          card={card}
          disabled={disabled}
          onPress={onPress}
          selected={selected}
          width={cardWidth}
        />
      </DealtCard>
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
});
