import { View } from 'react-native';

import type { LiquidGlassSurfaceProps } from './LiquidGlassSurface.types';

export function LiquidGlassSurface({
  fallbackStyle,
  interactive: _interactive,
  style,
  tone: _tone,
  ...props
}: LiquidGlassSurfaceProps) {
  return <View {...props} style={[fallbackStyle, style]} />;
}
