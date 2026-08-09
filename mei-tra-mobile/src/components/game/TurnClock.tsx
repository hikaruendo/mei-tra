import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { palette } from '@/theme/palette';
import { radius } from '@/theme/radius';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * The "it's your turn" clock, matching the web badge
 * (mei-tra-frontend/components/game/PlayerHand: .turnBadge + inline svg):
 * a brass clock on a raised disc, with the hand sweeping once every 3s.
 *
 * Replaces the previous ⏱ emoji, which rendered in the system font and did not
 * match web on either platform.
 */
export function TurnClock({ size = 26 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        // The native driver only handles style props; this animates an SVG
        // `rotation` prop, so it has to run on the JS driver or the hand
        // never moves.
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  // SVG's rotate() takes a bare number — a 'deg' suffix is a parse error
  // ("Expected ')'"), which silently killed the animation.
  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 360],
  });

  return (
    <View
      accessibilityLabel="現在の手番"
      accessibilityRole="image"
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg height="78%" viewBox="0 0 24 24" width="78%">
        <G
          fill="none"
          stroke={palette.text.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        >
          <Circle cx={12} cy={12} r={10.25} />
          {/* Tick marks at 12 / 3 / 6 / 9. */}
          <Path d="M12 4.5v1M19.5 12h-1M12 19.5v-1M4.5 12h1" />
          {/* The hand pivots on the dial centre, as transform-origin does on web. */}
          <AnimatedG
            originX={12}
            originY={12}
            rotation={rotation}
          >
            <Path d="M12 12V5.75" />
          </AnimatedG>
          <Circle
            cx={12}
            cy={12}
            fill={palette.text.primary}
            r={1.1}
            stroke="none"
          />
        </G>
      </Svg>
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
});
