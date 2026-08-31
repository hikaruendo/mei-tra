export type HandDropSide = "before" | "after";

/**
 * Folds an incoming hand into the order the player arranged by hand.
 *
 * Cards only ever leave a hand while the player is using it — they play one,
 * or set one aside as ネグリ — so a hand that lost cards keeps the arrangement.
 * A card *arriving* means the server dealt a new hand or handed over the アガリ,
 * and the server sorts by suit whenever it does that. Adopt its order then,
 * rather than pinning the old cards to where they used to sit and stranding the
 * new ones at the end, which is what left a hand ungrouped by suit.
 *
 * The "a card arrived" test is a subset check, so a re-deal that happened to
 * hand back only cards the player already held would keep the old arrangement.
 * That needs the same 10 cards to come out of a 41-card shuffle, so it is not
 * worth plumbing a re-deal signal through both clients to rule out.
 */
export const syncHandOrder = (
  previousOrder: readonly string[],
  hand: readonly string[],
): string[] => {
  const arranged = new Set(previousOrder);
  if (hand.some((card) => !arranged.has(card))) {
    return [...hand];
  }

  const held = new Set(hand);
  return previousOrder.filter((card) => held.has(card));
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
