import type { HandDropSide } from '@meitra/game-client/hand-order';

export interface HandDropPlacement {
  card: string;
  side: HandDropSide;
}

/**
 * How far apart two neighbouring cards sit in the fan.
 *
 * `cardMargin` is negative and React Native applies it to both sides, so each
 * card advances by its own width minus the overlap it shares with its
 * neighbours. Dragging a card by one pitch moves it one place.
 */
export const handFanPitch = (cardWidth: number, cardMargin: number): number =>
  cardWidth + cardMargin * 2;

const clamp = (min: number, max: number, value: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Reads the drop point from how far the finger has travelled sideways.
 *
 * Web hit-tests the card under the pointer, which touch has no equivalent for:
 * the finger covers the fan. Counting pitches instead keeps the card pinned to
 * the finger, which is the same distance either way because the slots are
 * exactly one pitch apart.
 *
 * Returns null while the card is still over its own slot.
 */
export const handDropPlacement = (
  order: readonly string[],
  draggedCard: string,
  deltaX: number,
  pitch: number,
): HandDropPlacement | null => {
  const fromIndex = order.indexOf(draggedCard);
  if (fromIndex < 0 || order.length < 2 || pitch <= 0) {
    return null;
  }

  const toIndex = clamp(
    0,
    order.length - 1,
    fromIndex + Math.round(deltaX / pitch),
  );
  if (toIndex === fromIndex) {
    return null;
  }

  return {
    card: order[toIndex],
    side: toIndex > fromIndex ? 'after' : 'before',
  };
};
