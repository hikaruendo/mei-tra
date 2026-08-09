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
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
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
      <Svg height="100%" viewBox="0 0 24 24" width="100%">
        <G
          fill="none"
          stroke={palette.accent.strong}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.6}
        >
          <Circle cx={12} cy={12} r={10.25} />
          {/* Tick marks at 12 / 3 / 6 / 9. */}
          <Path d="M12 4.5v1M19.5 12h-1M12 19.5v-1M4.5 12h1" />
          {/* The hand pivots on the dial centre, as transform-origin does on web. */}
          <AnimatedG
            originX={12}
            originY={12}
            rotation={rotation as unknown as number}
          >
            <Path d="M12 12V5.75" />
          </AnimatedG>
          <Circle
            cx={12}
            cy={12}
            fill={palette.accent.strong}
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
    backgroundColor: palette.surface.raised,
    // Web adds the same hairline so the disc keeps a defined edge where it
    // overhangs the seat corner.
    borderWidth: 1,
    borderColor: palette.border.hairline,
    borderCurve: 'circular',
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: radius.sm / 2,
    elevation: 2,
  },
});
