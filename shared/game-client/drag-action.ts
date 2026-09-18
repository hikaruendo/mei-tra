export type CardDropAction = 'play' | 'negri';
const PLAY_DROP_THRESHOLD_PX = 80;

export interface DropTargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A rect with no area, such as an element that is not laid out, never contains a point. */
export const isPointInRect = (
  point: { x: number; y: number },
  rect: DropTargetRect | null | undefined,
): boolean =>
  rect != null &&
  point.x >= rect.left &&
  point.x < rect.left + rect.width &&
  point.y >= rect.top &&
  point.y < rect.top + rect.height;

/**
 * What releasing a held hand card does in pro mode. The Negri is placed by
 * letting go over the player's own seat info, where the Negri is shown
 * afterwards; a card lifted far enough above the hand is played.
 */
export const classifyCardDrop = ({
  deltaY,
  overNegriTarget,
}: {
  deltaY: number;
  overNegriTarget: boolean;
}): CardDropAction | null => {
  if (overNegriTarget) return 'negri';
  if (deltaY <= -PLAY_DROP_THRESHOLD_PX) return 'play';
  return null;
};
