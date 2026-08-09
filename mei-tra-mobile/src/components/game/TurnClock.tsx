import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { palette } from '@/theme/palette';
import { radius } from '@/theme/radius';

const DIAL = palette.text.primary;

/**
 * The "it's your turn" clock, matching the web badge
 * (mei-tra-frontend/components/game/PlayerHand: .turnBadge + inline svg):
 * a brass disc with an ivory dial, the hand sweeping once every 3s.
 *
 * The hand lives in its own layer rotated by an Animated.View rather than an
 * animated <G>. Wrapping G in createAnimatedComponent leaks `collapsable` and
 * `transform-origin` into the DOM on react-native-web ("Invalid DOM property
 * transform-origin"), and a View transform rotates about its centre on both
 * platforms — which is exactly the pivot the dial needs.
 */
export function TurnClock({ size = 26 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const inner = Math.round(size * 0.78);

  return (
    <View
      accessibilityLabel="現在の手番"
      accessibilityRole="image"
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg height={inner} viewBox="0 0 24 24" width={inner}>
        <G
          fill="none"
          stroke={DIAL}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        >
          <Circle cx={12} cy={12} r={10.25} />
          {/* Ticks at 12 / 3 / 6 / 9. */}
          <Path d="M12 4.5v1M19.5 12h-1M12 19.5v-1M4.5 12h1" />
        </G>
        <Circle cx={12} cy={12} fill={DIAL} r={1.1} />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.hand,
          { width: inner, height: inner, transform: [{ rotate }] },
        ]}
      >
        <Svg height={inner} viewBox="0 0 24 24" width={inner}>
          <Path
            d="M12 12V5.75"
            stroke={DIAL}
            strokeLinecap="round"
            strokeWidth={2}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    // Solid brass disc with an ivory dial, matching web. A light disc on a
    // light card read as the card's fill bleeding past its border-radius.
    backgroundColor: palette.accent.base,
    borderCurve: 'circular',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: radius.sm / 2,
    elevation: 2,
  },
  hand: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 'auto',
  },
});
