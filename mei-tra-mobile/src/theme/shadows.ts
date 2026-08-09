import type { ViewStyle } from 'react-native';

/**
 * React Native shadow objects mirroring the web shadow tokens.
 *
 * CSS blur maps to iOS `shadowRadius` at roughly half its value; `elevation`
 * approximates the same weight on Android. Do NOT use the web `boxShadow`
 * string form here — it does not render consistently across platforms.
 */
const shadow = (
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: blur / 2,
  elevation,
});

export const shadows = {
  /** --mt-shadow-panel: 0 8px 24px rgba(0,0,0,.35) */
  panel: shadow(8, 24, 0.35, 8),
  /** --mt-shadow-btn: 0 4px 10px rgba(0,0,0,.28) */
  button: shadow(4, 10, 0.28, 4),
  /** $shadow-card: 0 2px 4px rgba(0,0,0,.2) */
  card: shadow(2, 4, 0.2, 3),
  /** --shadow-selected: 0 8px 20px rgba(0,0,0,.5) */
  cardSelected: shadow(8, 20, 0.5, 10),
} as const;
