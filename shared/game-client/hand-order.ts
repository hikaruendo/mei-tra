export type HandDropSide = "before" | "after";

/**
 * Folds a freshly dealt hand into the order the player arranged by hand.
 *
 * Cards the player still holds keep the position they were dragged to; cards
 * that were not in the hand before go to the end.
 */
export const syncHandOrder = (
  previousOrder: readonly string[],
  hand: readonly string[],
): string[] => {
  const held = new Set(hand);
  const retained = previousOrder.filter((card) => held.has(card));
  const added = hand.filter((card) => !retained.includes(card));

  return [...retained, ...added];
};

/**
 * Moves `sourceCard` to the given side of `targetCard`.
 *
 * Returns null when the order does not change, so callers can skip the sound
 * and the state update.
 */
export const reorderHand = (
  order: readonly string[],
  sourceCard: string,
  targetCard: string,
  side: HandDropSide,
): string[] | null => {
  const sourceIndex = order.indexOf(sourceCard);
  const targetIndex = order.indexOf(targetCard);
  if (sourceCard === targetCard || sourceIndex < 0 || targetIndex < 0) {
    return null;
  }

  const next = [...order];
  next.splice(sourceIndex, 1);
  const nextTargetIndex = next.indexOf(targetCard);
  next.splice(nextTargetIndex + (side === "after" ? 1 : 0), 0, sourceCard);

  return next.every((card, index) => card === order[index]) ? null : next;
};
