import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { MiniCard } from '@/components/game/MiniCard';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';
import type { CompletedFieldContract } from '@meitra/contracts/game';

/**
 * How far each card is pulled back over the one before it, face-down and once
 * the pile is turned over. A chip is 22 wide, so -14 leaves 8 of each card
 * showing — enough to count four of them. Web can afford a tighter stack
 * because it fans the cards with a small rotation, which the flip transform
 * here is already using.
 *
 * Pulled from the left only, and never on the first card: a margin on both
 * sides would reach outside the pile's own padding and run neighbouring piles
 * together into one band.
 */
const CLOSED_OVERLAP = -14;
const OPEN_OVERLAP = -4;
const FLIP_MS = 260;
/** Staggered so the four cards read as one movement. Matches web. */
const FLIP_STAGGER_MS = 55;

/**
 * A trick is only ever added or dropped whole, so its contents identify it. An
 * array index would not: a `game-state` resync re-sends the whole list, and a
 * pile the player had opened would follow the index rather than the trick.
 * Kept in step with mei-tra-frontend/components/game/CompletedFields.
 */
export const trickKey = (field: CompletedFieldContract) =>
  `${field.winnerSeatId}|${field.winnerTeam}|${field.cards.join(',')}`;

function TrickCard({
  card,
  index,
  open,
  reducedMotion,
}: {
  card: string;
  index: number;
  open: boolean;
  reducedMotion: boolean;
}) {
  const flip = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    const target = open ? 1 : 0;
    if (reducedMotion) {
      flip.setValue(target);
      return;
    }

    const animation = Animated.timing(flip, {
      toValue: target,
      duration: FLIP_MS,
      delay: index * FLIP_STAGGER_MS,
      // JS driver: marginHorizontal is a layout property and the native driver
      // only handles transforms and opacity. TurnClock uses it for the same
      // reason.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [flip, index, open, reducedMotion]);

  const rotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const marginLeft = flip.interpolate({
    inputRange: [0, 1],
    outputRange: [CLOSED_OVERLAP, OPEN_OVERLAP],
  });

  // Which face shows is driven by opacity, not backfaceVisibility: react
  // native web renders the rotation with transform-style flat, so the two
  // faces are not in the parent's 3D space and their backfaces never turn
  // away. Swapping at the halfway point of the rotation gives the same read
  // and behaves the same on both platforms.
  const backOpacity = flip.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const frontOpacity = flip.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <Animated.View
      style={[
        styles.slot,
        index === 0 ? null : { marginLeft },
        { transform: [{ perspective: 400 }, { rotateY: rotate }] },
      ]}
    >
      <Animated.View style={[styles.face, { opacity: backOpacity }]}>
        <MiniCard card={card} faceDown />
      </Animated.View>
      {/* Rotated back the other way so the parent's flip does not mirror the
          rank and suit. */}
      <Animated.View
        style={[styles.face, styles.frontFace, { opacity: frontOpacity }]}
      >
        <MiniCard card={card} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The tricks this player's team has won, laid face-down. Selecting a pile
 * turns its whole four-card set over; only one is open at a time.
 */
export function CompletedTrickPiles({
  fields,
  reducedMotion,
}: {
  fields: CompletedFieldContract[];
  reducedMotion?: boolean | null;
}) {
  const [openedKey, setOpenedKey] = useState<string | null>(null);

  // Derived, not reset in an effect: a new round arrives as an empty list and
  // the key simply stops matching anything.
  const openKey = fields.some((field) => trickKey(field) === openedKey)
    ? openedKey
    : null;

  if (fields.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {fields.map((field, index) => {
        const key = trickKey(field);
        const isOpen = key === openKey;

        return (
          <Pressable
            accessibilityLabel={t(
              isOpen ? 'board.hideTrick' : 'board.revealTrick',
              { index: index + 1 },
            )}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            key={key}
            onPress={() => setOpenedKey(isOpen ? null : key)}
            style={styles.pile}
            testID={`trick-pile-${index}`}
          >
            {field.cards.map((card, cardIndex) => (
              <TrickCard
                card={card}
                index={cardIndex}
                key={cardIndex}
                open={isOpen}
                reducedMotion={Boolean(reducedMotion)}
              />
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingVertical: 4,
  },
  pile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 4,
    backgroundColor: colors.backgroundElevated,
  },
  slot: {
    width: 22,
    height: 28,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    // Centred so MiniCard's own marginHorizontal (which it carries for the
    // face-up tally elsewhere) cancels out instead of shifting the card.
    alignItems: 'center',
    justifyContent: 'center',
  },
  frontFace: {
    transform: [{ rotateY: '180deg' }],
  },
});
