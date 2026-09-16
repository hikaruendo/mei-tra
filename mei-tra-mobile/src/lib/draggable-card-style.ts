import type { ViewStyle } from 'react-native';

/**
 * A browser decides whether a touch pans the page when the touch starts, before
 * a drag can turn the board's scrolling off, so a card that can be dragged opts
 * out of panning up front. React Native types have no `touchAction`, hence the
 * cast; react-native-web passes it through to CSS.
 */
export const draggableCardStyle: ViewStyle | null = {
  touchAction: 'none',
} as ViewStyle;
