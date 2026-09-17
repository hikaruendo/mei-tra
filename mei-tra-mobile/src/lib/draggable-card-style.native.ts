import type { ViewStyle } from 'react-native';

/**
 * Native touches have no pan decision to opt out of. The board turns its
 * scroll view off while a card is held instead.
 */
export const draggableCardStyle: ViewStyle | null = null;
