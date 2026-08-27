import {
  DEAL_CARD_INITIAL_SCALE,
  DEAL_CARD_TRANSLATE_X,
  dealCardAnimationTiming,
  type DealAnimationCue,
} from '@meitra/game-client/deal-animation';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface DealtCardProps extends PropsWithChildren {
  cue?: DealAnimationCue | null;
  index: number;
  reducedMotion: boolean | null;
  seatId: string;
}

export function DealtCard({
  children,
  cue = null,
  index,
  reducedMotion,
  seatId,
}: DealtCardProps) {
  const targeted = Boolean(cue?.seatIds.includes(seatId));
  const progress = useRef(
    new Animated.Value(targeted && reducedMotion !== true ? 0 : 1),
  ).current;

  useEffect(() => {
    progress.stopAnimation();

    if (!cue || !cue.seatIds.includes(seatId) || reducedMotion === true) {
      progress.setValue(1);
      return;
    }
    if (reducedMotion === null) {
      progress.setValue(0);
      return;
    }

    const timing = dealCardAnimationTiming(cue, index, Date.now());

    if (timing.durationMs === 0) {
      progress.setValue(1);
      return;
    }

    progress.setValue(timing.initialProgress);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: timing.durationMs,
      delay: timing.delayMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [cue, index, progress, reducedMotion, seatId]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [DEAL_CARD_TRANSLATE_X, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [DEAL_CARD_INITIAL_SCALE, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
