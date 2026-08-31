/**
 * The identity of a won trick.
 *
 * A trick is only ever added or dropped whole, and the server never sends one
 * with a field changed, so its contents identify it. That single definition is
 * used for two jobs that have to agree: dropping a trick the socket delivered
 * twice, and keying the pile a player has opened. An array index does neither —
 * a `game-state` resync re-sends the whole list, and an index follows the
 * position rather than the trick.
 *
 * Structural rather than typed against a contract so the transport shape
 * (`CompletedFieldContract`) and each app's UI shape both satisfy it without a
 * conversion.
 */
export interface CompletedFieldIdentity {
  dealerSeatId: string;
  winnerSeatId: string;
  winnerTeam: number;
  cards: readonly string[];
}

export const completedFieldKey = (field: CompletedFieldIdentity): string =>
  [
    field.dealerSeatId,
    field.winnerSeatId,
    field.winnerTeam,
    field.cards.join(','),
  ].join('|');
