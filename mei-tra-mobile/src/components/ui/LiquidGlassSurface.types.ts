import type { ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

export type LiquidGlassTone = 'neutral' | 'accent';

export interface LiquidGlassSurfaceProps extends ViewProps {
  children?: ReactNode;
  fallbackStyle?: StyleProp<ViewStyle>;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: LiquidGlassTone;
}
