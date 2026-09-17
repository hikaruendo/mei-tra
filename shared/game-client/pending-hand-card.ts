/**
 * A card the player sends to the field or to Negri leaves the hand on screen
 * right away, instead of sitting in its slot until the server answers.
 *
 * The client clears it once the server's hand no longer holds the card, or
 * when the server refuses with an error message. This timeout covers an
 * action the server answers with neither, so the card cannot stay hidden.
 */
export const PENDING_HAND_CARD_TIMEOUT_MS = 5000;

/** The hand to show while `pendingCard` waits for the server. */
export function withoutPendingHandCard<Card extends string>(
  hand: readonly Card[],
  pendingCard: string | null,
): Card[] {
  return pendingCard
    ? hand.filter((card) => card !== pendingCard)
    : [...hand];
}
