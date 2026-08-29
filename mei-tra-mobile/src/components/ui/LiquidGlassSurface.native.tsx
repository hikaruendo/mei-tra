import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { View } from 'react-native';

import { colors } from '@/theme/colors';

import type { LiquidGlassSurfaceProps } from './LiquidGlassSurface.types';

const canUseLiquidGlass = () =>
  isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

const regularGlassEffect = {
  style: 'regular',
  animate: true,
} as const;

export function LiquidGlassSurface({
  fallbackStyle,
  interactive = false,
  style,
  tone = 'neutral',
  ...props
}: LiquidGlassSurfaceProps) {
  if (!canUseLiquidGlass()) {
    return <View {...props} style={[fallbackStyle, style]} />;
  }

  return (
    <GlassView
      {...props}
      colorScheme="dark"
      glassEffectStyle={regularGlassEffect}
      isInteractive={interactive}
      style={style}
      tintColor={tone === 'accent' ? colors.gold : undefined}
    />
  );
}
